import { POINTS, type Match, type Prediction } from '@/types'
import { createServiceClient } from '@/lib/supabase/server'
import { checkAndAwardBadges, checkOracleBadge } from '@/lib/badges/engine'

// ============================================================
// Core scoring logic
// ============================================================

export function scoreExact(
  predictedHome: number,
  predictedAway: number,
  actualHome: number,
  actualAway: number
): boolean {
  return predictedHome === actualHome && predictedAway === actualAway
}

export function scoreOutcome(
  predictedHome: number,
  predictedAway: number,
  actualHome: number,
  actualAway: number
): boolean {
  const predictedOutcome = Math.sign(predictedHome - predictedAway)
  const actualOutcome = Math.sign(actualHome - actualAway)
  return predictedOutcome === actualOutcome
}

// ============================================================
// Process a finished match — award all points
// ============================================================

export async function processMatchResult(matchId: string) {
  const supabase = createServiceClient()

  // Fetch match with scores
  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select('*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*)')
    .eq('id', matchId)
    .single()

  if (matchError || !match || match.home_score === null || match.away_score === null) {
    console.error('processMatchResult: match not ready', matchId, matchError)
    return { processed: 0 }
  }

  const actualHome = match.home_score as number
  const actualAway = match.away_score as number

  // Fetch all predictions for this match
  const { data: predictions } = await supabase
    .from('predictions')
    .select('*')
    .eq('match_id', matchId)
    .is('processed_at', null)

  if (!predictions?.length) return { processed: 0 }

  let processedCount = 0

  for (const pred of predictions) {
    const isExact = scoreExact(pred.predicted_home, pred.predicted_away, actualHome, actualAway)
    const isCorrectOutcome = isExact || scoreOutcome(pred.predicted_home, pred.predicted_away, actualHome, actualAway)

    const basePoints = isExact
      ? POINTS.EXACT_SCORE
      : isCorrectOutcome
      ? POINTS.CORRECT_OUTCOME
      : 0

    // Calculate streak bonus
    let streakBonus = 0
    let newStreak = 0

    if (isExact) {
      // Get current streak
      const { data: profile } = await supabase
        .from('profiles')
        .select('current_streak, max_streak')
        .eq('id', pred.user_id)
        .single()

      const currentStreak = (profile?.current_streak ?? 0) + 1
      newStreak = currentStreak

      if (currentStreak >= POINTS.STREAK_STARTS_AT) {
        streakBonus = POINTS.STREAK_BONUS
      }

      const maxStreak = Math.max(profile?.max_streak ?? 0, currentStreak)

      await supabase
        .from('profiles')
        .update({ current_streak: currentStreak, max_streak: maxStreak })
        .eq('id', pred.user_id)
    } else {
      // Reset streak
      await supabase
        .from('profiles')
        .update({ current_streak: 0 })
        .eq('id', pred.user_id)
    }

    const totalPoints = basePoints + streakBonus

    // Update prediction
    await supabase
      .from('predictions')
      .update({
        is_exact: isExact,
        is_correct_outcome: isCorrectOutcome,
        points_base: basePoints,
        points_streak_bonus: streakBonus,
        points_total: totalPoints,
        processed_at: new Date().toISOString(),
      })
      .eq('id', pred.id)

    // Log point events
    if (basePoints > 0) {
      await supabase.from('point_events').insert({
        user_id: pred.user_id,
        type: isExact ? 'exact_score' : 'correct_outcome',
        points: basePoints,
        match_id: matchId,
        description: isExact
          ? `Exact score: ${actualHome}–${actualAway}`
          : `Correct outcome: ${actualHome}–${actualAway}`,
      })
    }

    if (streakBonus > 0) {
      await supabase.from('point_events').insert({
        user_id: pred.user_id,
        type: 'streak_bonus',
        points: streakBonus,
        match_id: matchId,
        description: `Hot streak bonus (${newStreak} in a row)`,
      })
    }

    // Update profile total points
    if (totalPoints > 0) {
      await supabase.rpc('increment_user_points', {
        p_user_id: pred.user_id,
        p_points: totalPoints,
      })
    }

    processedCount++

    // Check and award badges (non-blocking — errors are silently ignored)
    checkAndAwardBadges(pred.user_id, matchId).catch(() => {})
  }

  // Process goal events for scorer / favourite bonuses
  await reprocessGoalBonuses(matchId)

  return { processed: processedCount }
}

// ============================================================
// Award (or re-award) goal scorer + favourite team/player bonuses
// Fully idempotent — safe to call multiple times for the same match.
// Uses goal_event_id as a unique key on point_events so no bonus is
// ever double-awarded, even if a player was unlinked at match time
// and linked later.
// ============================================================

export async function reprocessGoalBonuses(matchId: string): Promise<{ bonusesAwarded: number }> {
  const supabase = createServiceClient()

  // (C5) Exclude shootout goals (minute > 120) — they don't earn scorer bonuses
  // They may be stored in goal_events but should not generate bonus points
  const { data: goals } = await supabase
    .from('goal_events')
    .select('*')
    .eq('match_id', matchId)
    .eq('is_own_goal', false)
    .or('minute.lte.120,minute.is.null')

  if (!goals?.length) return { bonusesAwarded: 0 }

  let bonusesAwarded = 0

  // Helper: insert a bonus point_event only if it doesn't already exist
  // (C1) Rely on insert failure (unique DB index) rather than SELECT-then-INSERT.
  // The DB unique index on (user_id, goal_event_id, type) provides the hard guarantee.
  // We attempt the insert and skip silently on conflict/error.
  async function awardIfNew(
    userId: string,
    type: string,
    points: number,
    goalEventId: string,
    description: string,
  ) {
    try {
      const { error } = await supabase.from('point_events').insert({
        user_id:       userId,
        type,
        points,
        match_id:      matchId,
        goal_event_id: goalEventId,
        description,
      })

      if (error) return // unique constraint conflict — already awarded, skip silently

      // Only reach here if insert succeeded (new bonus)
      await supabase.rpc('increment_user_points', {
        p_user_id: userId,
        p_points:  points,
      })

      bonusesAwarded++
    } catch {
      // unique constraint violation or other transient error — skip silently
    }
  }

  for (const goal of goals) {
    // Resolve player_id — may be null if player wasn't linked when goal was recorded.
    // If api_player_api_id is set, try to find the link now (retroactive resolution).
    let resolvedPlayerId: string | null = goal.player_id ?? null

    if (!resolvedPlayerId && goal.api_player_api_id) {
      const { data: linked } = await supabase
        .from('players')
        .select('id')
        .eq('api_id', goal.api_player_api_id)
        .maybeSingle()
      if (linked) {
        resolvedPlayerId = linked.id
        // Update the goal_event so future runs are faster
        await supabase.from('goal_events').update({ player_id: linked.id }).eq('id', goal.id)
      }
    }

    if (resolvedPlayerId) {
      // 1. Scorer picks — who picked this player?
      const { data: scorerPicks } = await supabase
        .from('scorer_picks')
        .select('user_id')
        .eq('player_id', resolvedPlayerId)
        .eq('team_id', goal.team_id)

      for (const pick of scorerPicks ?? []) {
        await awardIfNew(
          pick.user_id,
          'scorer_bonus',
          POINTS.SCORER_BONUS_PER_GOAL,
          goal.id,
          'Scorer bonus: assigned player scored',
        )
      }

      // 2. Favourite player bonus
      const { data: favPlayerUsers } = await supabase
        .from('profiles')
        .select('id')
        .eq('favourite_player_id', resolvedPlayerId)

      for (const user of favPlayerUsers ?? []) {
        await awardIfNew(
          user.id,
          'favourite_player_goal',
          POINTS.FAVOURITE_PLAYER_PER_GOAL,
          goal.id,
          'Secret bonus: favourite player scored',
        )
      }
    }

    // 3. Favourite team bonus
    const { data: favTeamUsers } = await supabase
      .from('profiles')
      .select('id')
      .eq('favourite_team_id', goal.team_id)

    for (const user of favTeamUsers ?? []) {
      await awardIfNew(
        user.id,
        'favourite_team_goal',
        POINTS.FAVOURITE_TEAM_PER_GOAL,
        goal.id,
        'Secret bonus: favourite team scored',
      )
    }

    // Keep processed flag updated for reference (no longer used as a gate)
    await supabase.from('goal_events').update({ processed: true }).eq('id', goal.id)
  }

  // Recalculate scorer_picks.goals_counted from scratch for every player
  // who scored in this match — keeps the counts accurate after re-runs
  const scoringPlayerIds = [...new Set(goals.filter((g: any) => g.player_id).map((g: any) => g.player_id as string))]
  for (const playerId of scoringPlayerIds) {
    const { count } = await supabase
      .from('goal_events')
      .select('id', { count: 'exact', head: true })
      .eq('player_id', playerId)
      .eq('is_own_goal', false)

    await supabase
      .from('scorer_picks')
      .update({
        goals_counted:  count ?? 0,
        points_awarded: (count ?? 0) * POINTS.SCORER_BONUS_PER_GOAL,
      })
      .eq('player_id', playerId)
  }

  return { bonusesAwarded }
}

// ============================================================
// Process finalist picks at end of tournament
// (N5) Idempotent: each point_event type is only inserted once per user
// ============================================================

export async function processFinalistPicks(
  actualFirstId: string,
  actualSecondId: string,
  actualThirdId: string
) {
  const supabase = createServiceClient()

  const { data: picks } = await supabase
    .from('finalist_picks')
    .select('*')
    .not('first_team_id', 'is', null)
    .not('second_team_id', 'is', null)
    .not('third_team_id', 'is', null)

  for (const pick of picks ?? []) {
    let points = 0
    const updates: Record<string, boolean | number> = {}

    if (pick.first_team_id === actualFirstId) {
      updates.first_correct = true
      points += POINTS.FINALIST_FIRST

      // (N5) Only insert if not already awarded — idempotent check
      const { data: existing1 } = await supabase
        .from('point_events')
        .select('id')
        .eq('user_id', pick.user_id)
        .eq('type', 'finalist_first')
        .maybeSingle()

      if (!existing1) {
        await supabase.from('point_events').insert({
          user_id: pick.user_id,
          type: 'finalist_first',
          points: POINTS.FINALIST_FIRST,
          description: 'Correct tournament winner pick',
        })
      }
    } else {
      updates.first_correct = false
    }

    if (pick.second_team_id === actualSecondId) {
      updates.second_correct = true
      points += POINTS.FINALIST_SECOND

      // (N5) Only insert if not already awarded
      const { data: existing2 } = await supabase
        .from('point_events')
        .select('id')
        .eq('user_id', pick.user_id)
        .eq('type', 'finalist_second')
        .maybeSingle()

      if (!existing2) {
        await supabase.from('point_events').insert({
          user_id: pick.user_id,
          type: 'finalist_second',
          points: POINTS.FINALIST_SECOND,
          description: 'Correct runner-up pick',
        })
      }
    } else {
      updates.second_correct = false
    }

    if (pick.third_team_id === actualThirdId) {
      updates.third_correct = true
      points += POINTS.FINALIST_THIRD

      // (N5) Only insert if not already awarded
      const { data: existing3 } = await supabase
        .from('point_events')
        .select('id')
        .eq('user_id', pick.user_id)
        .eq('type', 'finalist_third')
        .maybeSingle()

      if (!existing3) {
        await supabase.from('point_events').insert({
          user_id: pick.user_id,
          type: 'finalist_third',
          points: POINTS.FINALIST_THIRD,
          description: 'Correct 3rd place pick',
        })
      }
    } else {
      updates.third_correct = false
    }

    updates.points_awarded = points

    await supabase.from('finalist_picks').update(updates).eq('id', pick.id)

    if (points > 0) {
      await supabase.rpc('increment_user_points', {
        p_user_id: pick.user_id,
        p_points: points,
      })
    }

    // Check Oracle badge (non-blocking)
    checkOracleBadge(pick.user_id).catch(() => {})
  }
}
