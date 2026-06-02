import { createServiceClient } from '@/lib/supabase/server'

/**
 * Check and award all applicable badges for a user after a match result.
 * Safe to call multiple times — UNIQUE constraint prevents duplicates.
 * Returns array of newly earned badge_ids.
 */
export async function checkAndAwardBadges(userId: string, matchId: string): Promise<string[]> {
  const supabase = createServiceClient()
  const newBadges: string[] = []

  async function award(badgeId: string) {
    const { error } = await supabase.from('user_badges').insert({ user_id: userId, badge_id: badgeId })
    if (!error) newBadges.push(badgeId) // error = already exists (unique) — skip silently
  }

  // ── Fetch what we need ──────────────────────────────────────────
  const [predRes, profileRes, matchRes] = await Promise.all([
    supabase.from('predictions').select('is_exact, is_correct_outcome, points_total, processed_at').eq('user_id', userId).eq('match_id', matchId).maybeSingle(),
    supabase.from('profiles').select('current_streak, favourite_team_id, favourite_player_id').eq('id', userId).single(),
    supabase.from('matches').select('home_score, away_score').eq('id', matchId).single(),
  ])

  const pred    = predRes.data
  const profile = profileRes.data
  const match   = matchRes.data

  if (!pred || !profile || !match) return newBadges

  const totalGoals = (match.home_score ?? 0) + (match.away_score ?? 0)

  // first_blood — any correct outcome
  if (pred.is_correct_outcome) await award('first_blood')

  // sharpshooter — first exact score
  if (pred.is_exact) await award('sharpshooter')

  // on_fire — 3 in a row
  if ((profile.current_streak ?? 0) >= 3) await award('on_fire')

  // unstoppable — 5 in a row
  if ((profile.current_streak ?? 0) >= 5) await award('unstoppable')

  // lucky_devil — exact on 5+ goal match
  if (pred.is_exact && totalGoals >= 5) await award('lucky_devil')

  // talent_scout — any scorer pick has 5+ goals (tournament-wide)
  const { data: scorerPicks } = await supabase
    .from('scorer_picks')
    .select('goals_counted')
    .eq('user_id', userId)
    .gte('goals_counted', 5)
  if ((scorerPicks?.length ?? 0) > 0) await award('talent_scout')

  // twelfth_man — fav team scored 10+ goals total
  if (profile.favourite_team_id) {
    const { count } = await supabase
      .from('goal_events')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', profile.favourite_team_id)
      .eq('is_own_goal', false)
    if ((count ?? 0) >= 10) await award('twelfth_man')
  }

  // committed — predicted every group stage match
  const { count: groupMatchCount } = await supabase
    .from('matches')
    .select('id', { count: 'exact', head: true })
    .eq('stage', 'group')
    .not('home_team_id', 'is', null)

  const groupMatchIds = (await supabase.from('matches').select('id').eq('stage', 'group')).data?.map((m: { id: string }) => m.id) ?? []

  const { count: groupPredCount } = await supabase
    .from('predictions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('match_id', groupMatchIds)

  if ((groupMatchCount ?? 0) > 0 && groupPredCount === groupMatchCount) await award('committed')

  return newBadges
}

/**
 * Award Oracle badge when finalist picks are processed.
 * Call from processFinalistPicks after awarding points.
 */
export async function checkOracleBadge(userId: string): Promise<boolean> {
  const supabase = createServiceClient()
  const { data: fp } = await supabase
    .from('finalist_picks')
    .select('first_correct, second_correct, third_correct')
    .eq('user_id', userId)
    .maybeSingle()

  if (fp?.first_correct && fp?.second_correct && fp?.third_correct) {
    const { error } = await supabase.from('user_badges').insert({ user_id: userId, badge_id: 'oracle' })
    return !error
  }
  return false
}

/**
 * Award Champion badge — call once when tournament ends.
 */
export async function checkChampionBadge(): Promise<void> {
  const supabase = createServiceClient()
  const { data: top } = await supabase
    .from('leaderboard')
    .select('id')
    .eq('rank', 1)
    .maybeSingle()
  if (top?.id) {
    await supabase.from('user_badges').insert({ user_id: top.id, badge_id: 'champion' })
  }
}
