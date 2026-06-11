import { createClient } from '@/lib/supabase/server'
import { getNow } from '@/lib/utils'
import { POINTS } from '@/types'

// ============================================================
// Types
// ============================================================

export interface MatchCentreData {
  matchId: string
  state: 'upcoming' | 'preview' | 'live' | 'finished'
  minutesUntilKickoff: number
  match: {
    id: string
    kickoff_at: string
    home_score: number | null
    away_score: number | null
    status: string
    venue: string | null
    group_letter: string | null
    home_team: { id: string; name: string; flag_url: string | null }
    away_team: { id: string; name: string; flag_url: string | null }
  }
  goalEvents: Array<{
    id: string
    minute: number | null
    player_name: string | null
    team_id: string
    is_own_goal: boolean
  }>
  predictions: Array<{
    userId: string
    displayName: string
    predictedHome: number
    predictedAway: number
    matchPoints: number
    squadPoints: number
    teamPoints: number
    status: 'on_ball' | 'happy' | 'still_in' | 'out'
    scorerPickName: string | null
    scorerPickPhoto: string | null
    favPlayerIsInMatch: boolean
    favPlayerPhoto: string | null
    favPlayerName: string | null
  }>
  homeFans: Array<{ userId: string; displayName: string }>
  awayFans: Array<{ userId: string; displayName: string }>
}

// ============================================================
// Status computation
// ============================================================

function computeStatus(
  predictedHome: number,
  predictedAway: number,
  currentHome: number,
  currentAway: number,
): 'on_ball' | 'happy' | 'still_in' | 'out' {
  // Exact score match right now
  if (predictedHome === currentHome && predictedAway === currentAway) return 'on_ball'

  const predOutcome = Math.sign(predictedHome - predictedAway)
  const currOutcome = Math.sign(currentHome - currentAway)

  // Exact score still mathematically achievable (scores can only go up)
  // e.g. predicted 2-0, current 1-0 → still possible
  const exactStillAchievable = predictedHome >= currentHome && predictedAway >= currentAway

  // Correct outcome direction → Happy Fans (getting +50, might upgrade)
  if (predOutcome === currOutcome) return 'happy'

  // Wrong outcome currently BUT exact score still achievable → Still in it
  // e.g. predicted 2-1, current 0-1 → home can still score twice, away stays at 1
  if (exactStillAchievable) return 'still_in'

  // Wrong outcome AND exact not achievable — can the outcome still change?
  if (currentHome === 0 && currentAway === 0) return 'still_in'
  if (predOutcome === 1 && currentHome >= currentAway) return 'still_in'
  if (predOutcome === -1 && currentAway >= currentHome) return 'still_in'
  if (predOutcome === 0 && Math.abs(currentHome - currentAway) <= 1) return 'still_in'

  return 'out'
}

function computeMatchPoints(
  predictedHome: number,
  predictedAway: number,
  currentHome: number,
  currentAway: number,
): number {
  if (predictedHome === currentHome && predictedAway === currentAway) return POINTS.EXACT_SCORE
  const predOutcome = Math.sign(predictedHome - predictedAway)
  const currOutcome = Math.sign(currentHome - currentAway)
  if (predOutcome === currOutcome) return POINTS.CORRECT_OUTCOME
  return 0
}

// ============================================================
// Main data fetcher
// ============================================================

export async function getMatchCentreData(isAdmin = false): Promise<MatchCentreData | null> {
  const supabase = await createClient()
  const now = getNow()

  const nowIso = now.toISOString()
  const plus60 = new Date(now.getTime() + 60 * 60 * 1000).toISOString()
  const minus30 = new Date(now.getTime() - 30 * 60 * 1000).toISOString()
  const minus45 = new Date(now.getTime() - 45 * 60 * 1000).toISOString()

  // 1. Find the current match — priority: in_play > starting within 60min > just kicked off > finished within 45min
  let currentMatch: any = null
  let state: MatchCentreData['state'] = 'live'

  // in_play
  const { data: inPlay } = await supabase
    .from('matches')
    .select('*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*)')
    .eq('status', 'in_play')
    .not('home_team_id', 'is', null)
    .not('away_team_id', 'is', null)
    .order('kickoff_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (inPlay) {
    currentMatch = inPlay
    state = 'live'
  }

  if (!currentMatch) {
    // starting within 60 min (upcoming)
    const { data: upcoming } = await supabase
      .from('matches')
      .select('*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*)')
      .eq('status', 'scheduled')
      .not('home_team_id', 'is', null)
      .not('away_team_id', 'is', null)
      .gt('kickoff_at', nowIso)
      .lte('kickoff_at', plus60)
      .order('kickoff_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (upcoming) {
      currentMatch = upcoming
      state = 'upcoming'
    }
  }

  if (!currentMatch) {
    // just kicked off but cron hasn't updated status yet (preview)
    const { data: preview } = await supabase
      .from('matches')
      .select('*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*)')
      .eq('status', 'scheduled')
      .not('home_team_id', 'is', null)
      .not('away_team_id', 'is', null)
      .lte('kickoff_at', nowIso)
      .gte('kickoff_at', minus30)
      .order('kickoff_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (preview) {
      currentMatch = preview
      state = 'preview'
    }
  }

  if (!currentMatch) {
    // finished within 45 min
    const { data: finished } = await supabase
      .from('matches')
      .select('*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*)')
      .eq('status', 'finished')
      .not('home_team_id', 'is', null)
      .not('away_team_id', 'is', null)
      .gte('result_fetched_at', minus45)
      .order('result_fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (finished) {
      currentMatch = finished
      state = 'finished'
    }
  }

  // Admin preview — override with simulation data if active
  let previewGoalEvents: MatchCentreData['goalEvents'] | null = null
  if (isAdmin) {
    const { createServiceClient } = await import('@/lib/supabase/server')
    const service = createServiceClient()
    const { data: preview } = await service
      .from('match_centre_preview')
      .select('*')
      .limit(1)
      .maybeSingle()

    if (preview) {
      // Load the preview match (overrides whatever match was found above)
      const { data: prevMatch } = await supabase
        .from('matches')
        .select('*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*)')
        .eq('id', preview.match_id)
        .single()

      if (prevMatch) {
        currentMatch = {
          ...prevMatch,
          home_score: preview.home_score,
          away_score: preview.away_score,
        }
        state = preview.state as MatchCentreData['state']
        previewGoalEvents = (preview.goal_events ?? []).map((g: any, i: number) => ({
          id: `preview-${i}`,
          minute: g.minute ?? null,
          player_name: g.player_name ?? null,
          team_id: g.team_id ?? prevMatch.home_team_id,
          is_own_goal: g.is_own_goal ?? false,
        }))
      }
    }
  }

  if (!currentMatch) return null

  const homeTeamId: string = currentMatch.home_team_id
  const awayTeamId: string = currentMatch.away_team_id
  const matchId: string = currentMatch.id

  const kickoffDate = new Date(currentMatch.kickoff_at)
  const minutesUntilKickoff = Math.max(0, Math.round((kickoffDate.getTime() - now.getTime()) / 60000))

  // 2. Fetch supporting data in parallel
  const [goalEventsRes, predictionsRes, profilesRes, scorerPicksRes, playersInMatchRes] = await Promise.all([
    supabase
      .from('goal_events')
      .select('id, minute, team_id, is_own_goal, player_id, player:players(name)')
      .eq('match_id', matchId)
      .order('minute', { ascending: true }),

    supabase
      .from('predictions')
      .select('user_id, predicted_home, predicted_away, profile:profiles(display_name)')
      .eq('match_id', matchId),

    supabase
      .from('profiles')
      .select('id, display_name, favourite_team_id, favourite_player_id'),

    supabase
      .from('scorer_picks')
      .select('user_id, player_id, team_id, player:players(name, photo_url)')
      .in('team_id', [homeTeamId, awayTeamId]),

    supabase
      .from('players')
      .select('id, name, photo_url')
      .in('team_id', [homeTeamId, awayTeamId])
      .limit(200),
  ])

  const rawGoalEvents: any[] = goalEventsRes.data ?? []
  const rawPredictions: any[] = predictionsRes.data ?? []
  const rawProfiles: any[] = profilesRes.data ?? []
  const rawScorerPicks: any[] = scorerPicksRes.data ?? []

  // Build player lookup: playerId -> { photoUrl, name } for players in this match
  const playersInMatch = new Map<string, { photoUrl: string | null; name: string | null }>()
  for (const p of (playersInMatchRes.data ?? [])) {
    playersInMatch.set(p.id, { photoUrl: (p as any).photo_url ?? null, name: (p as any).name ?? null })
  }

  // Build goal events — use preview override if set, otherwise from DB
  const goalEvents: MatchCentreData['goalEvents'] = previewGoalEvents ?? rawGoalEvents.map((ge: any) => {
    const player = Array.isArray(ge.player) ? ge.player[0] : ge.player
    return {
      id: ge.id,
      minute: ge.minute ?? null,
      player_name: player?.name ?? null,
      team_id: ge.team_id,
      is_own_goal: ge.is_own_goal,
    }
  })

  // Build scorer pick lookup: userId -> Set of player_ids
  const scorerPicksByUser = new Map<string, Set<string>>()
  for (const sp of rawScorerPicks) {
    if (!scorerPicksByUser.has(sp.user_id)) scorerPicksByUser.set(sp.user_id, new Set())
    scorerPicksByUser.get(sp.user_id)!.add(sp.player_id)
  }

  // Build map: userId -> { playerName, photoUrl } for picks in this match
  const scorerPickInMatch = new Map<string, { playerName: string; photoUrl: string | null }>()
  for (const sp of rawScorerPicks) {
    const player = Array.isArray(sp.player) ? sp.player[0] : sp.player
    if (player) scorerPickInMatch.set(sp.user_id, { playerName: player.name, photoUrl: player.photo_url ?? null })
  }

  // Count goals by player and by team in this match
  const goalsByPlayer = new Map<string, number>()
  const goalsByTeam = new Map<string, number>()
  for (const ge of rawGoalEvents) {
    if (!ge.is_own_goal) {
      if (ge.player_id) {
        goalsByPlayer.set(ge.player_id, (goalsByPlayer.get(ge.player_id) ?? 0) + 1)
      }
      goalsByTeam.set(ge.team_id, (goalsByTeam.get(ge.team_id) ?? 0) + 1)
    }
  }

  // Build profile lookup for fav team
  const profileMap = new Map<string, any>()
  for (const p of rawProfiles) profileMap.set(p.id, p)

  const currentHome = currentMatch.home_score ?? 0
  const currentAway = currentMatch.away_score ?? 0

  // Compute predictions with points
  const predictions: MatchCentreData['predictions'] = rawPredictions.map((pred: any) => {
    const profileArr = Array.isArray(pred.profile) ? pred.profile : [pred.profile]
    const profile = profileArr[0]
    const displayName: string = profile?.display_name ?? 'Unknown'
    const userId: string = pred.user_id
    const predictedHome: number = pred.predicted_home
    const predictedAway: number = pred.predicted_away

    const matchPoints = computeMatchPoints(predictedHome, predictedAway, currentHome, currentAway)

    // Squad points: sum goals scored by this user's scorer picks in this match
    const pickedPlayerIds = scorerPicksByUser.get(userId) ?? new Set<string>()
    let squadGoals = 0
    for (const [playerId, goals] of goalsByPlayer.entries()) {
      if (pickedPlayerIds.has(playerId)) squadGoals += goals
    }
    const squadPoints = squadGoals * POINTS.SCORER_BONUS_PER_GOAL

    // Team points: goals by user's fav team in this match
    const userProfile = profileMap.get(userId)
    const favTeamId: string | null = userProfile?.favourite_team_id ?? null
    const teamGoals = favTeamId ? (goalsByTeam.get(favTeamId) ?? 0) : 0
    const teamPoints = teamGoals * POINTS.FAVOURITE_TEAM_PER_GOAL

    const status = computeStatus(predictedHome, predictedAway, currentHome, currentAway)

    const favPlayerId: string | null = profileMap.get(userId)?.favourite_player_id ?? null
    const favPlayerIsInMatch = favPlayerId != null && playersInMatch.has(favPlayerId)
    const favPlayerEntry = favPlayerIsInMatch ? (playersInMatch.get(favPlayerId!) ?? null) : null

    return {
      userId,
      displayName,
      predictedHome,
      predictedAway,
      matchPoints,
      squadPoints,
      teamPoints,
      status,
      scorerPickName: scorerPickInMatch.get(userId)?.playerName ?? null,
      scorerPickPhoto: scorerPickInMatch.get(userId)?.photoUrl ?? null,
      favPlayerIsInMatch,
      favPlayerPhoto: favPlayerEntry?.photoUrl ?? null,
      favPlayerName: favPlayerEntry?.name ?? null,
    }
  })

  // Fan lists
  const homeFans: MatchCentreData['homeFans'] = rawProfiles
    .filter((p: any) => p.favourite_team_id === homeTeamId)
    .map((p: any) => ({ userId: p.id, displayName: p.display_name }))
    .sort((a: any, b: any) => a.displayName.localeCompare(b.displayName))

  const awayFans: MatchCentreData['awayFans'] = rawProfiles
    .filter((p: any) => p.favourite_team_id === awayTeamId)
    .map((p: any) => ({ userId: p.id, displayName: p.display_name }))
    .sort((a: any, b: any) => a.displayName.localeCompare(b.displayName))

  const homeTeam = Array.isArray(currentMatch.home_team)
    ? currentMatch.home_team[0]
    : currentMatch.home_team
  const awayTeam = Array.isArray(currentMatch.away_team)
    ? currentMatch.away_team[0]
    : currentMatch.away_team

  return {
    matchId,
    state,
    minutesUntilKickoff,
    match: {
      id: matchId,
      kickoff_at: currentMatch.kickoff_at,
      home_score: currentMatch.home_score,
      away_score: currentMatch.away_score,
      status: currentMatch.status,
      venue: currentMatch.venue ?? null,
      group_letter: currentMatch.group_letter ?? null,
      home_team: {
        id: homeTeam.id,
        name: homeTeam.name,
        flag_url: homeTeam.flag_url ?? null,
      },
      away_team: {
        id: awayTeam.id,
        name: awayTeam.name,
        flag_url: awayTeam.flag_url ?? null,
      },
    },
    goalEvents,
    predictions,
    homeFans,
    awayFans,
  }
}
