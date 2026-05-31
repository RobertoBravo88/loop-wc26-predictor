import { POINTS, type Match, type Prediction } from '@/types'
import { createServiceClient } from '@/lib/supabase/server'

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
  }

  // Process goal events for scorer / favourite bonuses
  await processGoalBonuses(matchId, match.home_team_id, match.away_team_id)

  return { processed: processedCount }
}

// ============================================================
// Award goal scorer + favourite team/player bonuses
// ============================================================

async function processGoalBonuses(
  matchId: string,
  homeTeamId: string,
  awayTeamId: string
) {
  const supabase = createServiceClient()

  // Get unprocessed goals for this match (exclude own goals for scorer/fav bonuses)
  const { data: goals } = await supabase
    .from('goal_events')
    .select('*')
    .eq('match_id', matchId)
    .eq('processed', false)
    .eq('is_own_goal', false)

  if (!goals?.length) return

  for (const goal of goals) {
    // 1. Scorer picks — who picked this player for this team?
    if (goal.player_id) {
      const { data: scorerPicks } = await supabase
        .from('scorer_picks')
        .select('*')
        .eq('player_id', goal.player_id)
        .eq('team_id', goal.team_id)

      for (const pick of scorerPicks ?? []) {
        await supabase
          .from('scorer_picks')
          .update({
            goals_counted: pick.goals_counted + 1,
            points_awarded: pick.points_awarded + POINTS.SCORER_BONUS_PER_GOAL,
          })
          .eq('id', pick.id)

        await supabase.from('point_events').insert({
          user_id: pick.user_id,
          type: 'scorer_bonus',
          points: POINTS.SCORER_BONUS_PER_GOAL,
          match_id: matchId,
          description: `Scorer bonus: assigned player scored`,
        })

        await supabase.rpc('increment_user_points', {
          p_user_id: pick.user_id,
          p_points: POINTS.SCORER_BONUS_PER_GOAL,
        })
      }

      // 2. Favourite player bonus
      const { data: favPlayerUsers } = await supabase
        .from('profiles')
        .select('id')
        .eq('favourite_player_id', goal.player_id)

      for (const user of favPlayerUsers ?? []) {
        await supabase.from('point_events').insert({
          user_id: user.id,
          type: 'favourite_player_goal',
          points: POINTS.FAVOURITE_PLAYER_PER_GOAL,
          match_id: matchId,
          description: `Secret bonus: favourite player scored`,
        })

        await supabase.rpc('increment_user_points', {
          p_user_id: user.id,
          p_points: POINTS.FAVOURITE_PLAYER_PER_GOAL,
        })
      }
    }

    // 3. Favourite team bonus
    const { data: favTeamUsers } = await supabase
      .from('profiles')
      .select('id')
      .eq('favourite_team_id', goal.team_id)

    for (const user of favTeamUsers ?? []) {
      await supabase.from('point_events').insert({
        user_id: user.id,
        type: 'favourite_team_goal',
        points: POINTS.FAVOURITE_TEAM_PER_GOAL,
        match_id: matchId,
        description: `Secret bonus: favourite team scored`,
      })

      await supabase.rpc('increment_user_points', {
        p_user_id: user.id,
        p_points: POINTS.FAVOURITE_TEAM_PER_GOAL,
      })
    }

    // Mark goal as processed
    await supabase
      .from('goal_events')
      .update({ processed: true })
      .eq('id', goal.id)
  }
}

// ============================================================
// Process finalist picks at end of tournament
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
    .not('locked_at', 'is', null)

  for (const pick of picks ?? []) {
    let points = 0
    const updates: Record<string, boolean | number> = {}

    if (pick.first_team_id === actualFirstId) {
      updates.first_correct = true
      points += POINTS.FINALIST_FIRST
      await supabase.from('point_events').insert({
        user_id: pick.user_id,
        type: 'finalist_first',
        points: POINTS.FINALIST_FIRST,
        description: 'Correct tournament winner pick',
      })
    } else {
      updates.first_correct = false
    }

    if (pick.second_team_id === actualSecondId) {
      updates.second_correct = true
      points += POINTS.FINALIST_SECOND
      await supabase.from('point_events').insert({
        user_id: pick.user_id,
        type: 'finalist_second',
        points: POINTS.FINALIST_SECOND,
        description: 'Correct runner-up pick',
      })
    } else {
      updates.second_correct = false
    }

    if (pick.third_team_id === actualThirdId) {
      updates.third_correct = true
      points += POINTS.FINALIST_THIRD
      await supabase.from('point_events').insert({
        user_id: pick.user_id,
        type: 'finalist_third',
        points: POINTS.FINALIST_THIRD,
        description: 'Correct 3rd place pick',
      })
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
  }
}
