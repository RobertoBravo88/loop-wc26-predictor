import { createClient } from '@/lib/supabase/server'
import type { Match, Team, GroupStanding, MatchStage } from '@/types'
import GroupsPageClient from '@/components/groups/GroupsPageClient'
import type { GroupData, KnockoutData, TopScorer } from '@/components/groups/GroupsPageClient'

export const revalidate = 60

const GROUPS = ['A','B','C','D','E','F','G','H','I','J','K','L']
const KNOCKOUT_STAGES: MatchStage[] = ['round_of_32', 'round_of_16', 'quarter_final', 'semi_final', 'third_place', 'final']

function computeStandings(matches: Match[], teams: Team[]): GroupStanding[] {
  const table = new Map<string, GroupStanding>()
  for (const t of teams) {
    table.set(t.id, { team: t, played: 0, won: 0, drawn: 0, lost: 0, goals_for: 0, goals_against: 0, goal_difference: 0, points: 0 })
  }

  for (const m of matches) {
    if (m.home_score === null || m.away_score === null) continue
    const home = table.get(m.home_team_id!)
    const away = table.get(m.away_team_id!)
    if (!home || !away) continue

    home.played++; away.played++
    home.goals_for += m.home_score; home.goals_against += m.away_score
    away.goals_for += m.away_score; away.goals_against += m.home_score
    home.goal_difference = home.goals_for - home.goals_against
    away.goal_difference = away.goals_for - away.goals_against

    if (m.home_score > m.away_score) {
      home.won++; home.points += 3; away.lost++
    } else if (m.home_score < m.away_score) {
      away.won++; away.points += 3; home.lost++
    } else {
      home.drawn++; home.points++; away.drawn++; away.points++
    }
  }

  return Array.from(table.values()).sort((a, b) =>
    b.points - a.points || b.goal_difference - a.goal_difference || b.goals_for - a.goals_for
  )
}

function computePredictedStandings(matches: Match[], teams: Team[], predictions: Map<string, { h: number; a: number }>): GroupStanding[] {
  const table = new Map<string, GroupStanding>()
  for (const t of teams) {
    table.set(t.id, { team: t, played: 0, won: 0, drawn: 0, lost: 0, goals_for: 0, goals_against: 0, goal_difference: 0, points: 0 })
  }

  for (const m of matches) {
    const pred = predictions.get(m.id)
    if (!pred) continue
    const home = table.get(m.home_team_id!); const away = table.get(m.away_team_id!)
    if (!home || !away) continue

    home.played++; away.played++
    home.goals_for += pred.h; home.goals_against += pred.a
    away.goals_for += pred.a; away.goals_against += pred.h
    home.goal_difference = home.goals_for - home.goals_against
    away.goal_difference = away.goals_for - away.goals_against

    if (pred.h > pred.a) { home.won++; home.points += 3; away.lost++ }
    else if (pred.h < pred.a) { away.won++; away.points += 3; home.lost++ }
    else { home.drawn++; home.points++; away.drawn++; away.points++ }
  }

  return Array.from(table.values()).sort((a, b) =>
    b.points - a.points || b.goal_difference - a.goal_difference || b.goals_for - a.goals_for
  )
}

export default async function GroupsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [
    { data: teams },
    { data: matches },
    { data: knockoutMatches },
    { data: lastSyncRow },
    { data: goalEventsRaw },
  ] = await Promise.all([
    supabase.from('teams').select('*').order('name'),
    supabase.from('matches').select('*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*)').eq('stage', 'group').order('kickoff_at'),
    supabase.from('matches').select('*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*)').in('stage', KNOCKOUT_STAGES).order('kickoff_at'),
    supabase.from('matches').select('result_fetched_at').not('result_fetched_at', 'is', null).order('result_fetched_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('goal_events')
      .select('player_id, team_id, player:players(id, name), team:teams(name, flag_url)')
      .eq('is_own_goal', false),
  ])

  const lastSynced = lastSyncRow?.result_fetched_at ?? null

  // Fetch predictions for the logged-in user
  const predictionMap = new Map<string, { h: number; a: number }>()
  if (user) {
    const groupIds = (matches ?? []).map(m => m.id)
    const knockoutIds = (knockoutMatches ?? []).map(m => m.id)
    const { data: preds } = await supabase
      .from('predictions')
      .select('match_id, predicted_home, predicted_away')
      .eq('user_id', user.id)
      .in('match_id', [...groupIds, ...knockoutIds])
    for (const p of preds ?? []) predictionMap.set(p.match_id, { h: p.predicted_home, a: p.predicted_away })
  }

  // Fetch scorer picks for the logged-in user
  let scorerPicksData: { player_id: string }[] = []
  if (user) {
    const { data } = await supabase
      .from('scorer_picks')
      .select('player_id')
      .eq('user_id', user.id)
    scorerPicksData = data ?? []
  }

  // Aggregate goal events into topScorers
  const scorerMap = new Map<string, TopScorer>()
  for (const ge of goalEventsRaw ?? []) {
    const playerId = (ge as any).player_id
    if (!playerId || !(ge as any).player) continue
    const player = (ge as any).player
    const team = (ge as any).team
    if (scorerMap.has(playerId)) {
      scorerMap.get(playerId)!.goals++
    } else {
      scorerMap.set(playerId, {
        id: playerId,
        name: player.name,
        teamName: (team?.name ?? ''),
        flagUrl: (team?.flag_url ?? null),
        goals: 1,
        isMyPick: false,
      })
    }
  }
  const myPickIds = new Set((scorerPicksData ?? []).map((p: any) => p.player_id))
  for (const [id, scorer] of scorerMap) {
    scorer.isMyPick = myPickIds.has(id)
  }
  const topScorers: TopScorer[] = Array.from(scorerMap.values()).sort((a, b) => b.goals - a.goals)

  // Convert Maps to plain objects for client component
  const predictionObj: Record<string, { h: number; a: number }> = {}
  for (const [k, v] of predictionMap) predictionObj[k] = v

  const allTeams = (teams ?? []) as Team[]
  const allMatches = (matches ?? []) as Match[]

  // Index teams and matches by group letter
  const teamsByGroup = new Map<string, Team[]>()
  for (const t of allTeams) {
    if (!t.group_letter) continue
    if (!teamsByGroup.has(t.group_letter)) teamsByGroup.set(t.group_letter, [])
    teamsByGroup.get(t.group_letter)!.push(t)
  }

  const matchesByGroup = new Map<string, Match[]>()
  for (const m of allMatches) {
    if (!m.group_letter) continue
    if (!matchesByGroup.has(m.group_letter)) matchesByGroup.set(m.group_letter, [])
    matchesByGroup.get(m.group_letter)!.push(m)
  }

  // Build group leaders map for bracket slot labels
  const groupLeadersMap = new Map<string, { p1?: string; p2?: string; complete: boolean }>()
  for (const g of GROUPS) {
    const groupTeams = teamsByGroup.get(g) ?? []
    const groupMatches = matchesByGroup.get(g) ?? []
    const standings = computeStandings(groupMatches, groupTeams)
    const complete = groupMatches.length > 0 && groupMatches.every(m => m.status === 'finished')
    groupLeadersMap.set(g, { p1: standings[0]?.team.name, p2: standings[1]?.team.name, complete })
  }

  // Convert groupLeaders map to plain object
  const groupLeadersObj: Record<string, { p1?: string; p2?: string; complete: boolean }> = {}
  for (const [k, v] of groupLeadersMap) groupLeadersObj[k] = v

  // Build groupData array
  const groupData: GroupData[] = GROUPS.map(g => {
    const groupTeams = teamsByGroup.get(g) ?? []
    const groupMatches = matchesByGroup.get(g) ?? []
    const realStandings = computeStandings(groupMatches, groupTeams)

    const groupPredictionMap = new Map<string, { h: number; a: number }>()
    for (const m of groupMatches) {
      const pred = predictionMap.get(m.id)
      if (pred) groupPredictionMap.set(m.id, pred)
    }
    const hasPredictions = groupPredictionMap.size > 0
    const predictedStandings = user && hasPredictions
      ? computePredictedStandings(groupMatches, groupTeams, groupPredictionMap)
      : []

    return {
      letter: g,
      matches: groupMatches,
      realStandings,
      predictedStandings,
    }
  })

  // Build knockoutData array
  const byStage = new Map<MatchStage, Match[]>()
  for (const m of (knockoutMatches as Match[] ?? [])) {
    if (!byStage.has(m.stage)) byStage.set(m.stage, [])
    byStage.get(m.stage)!.push(m)
  }

  const knockoutData: KnockoutData[] = KNOCKOUT_STAGES.map(stage => ({
    stage,
    matches: byStage.get(stage) ?? [],
  }))

  return (
    <GroupsPageClient
      groupData={groupData}
      knockoutData={knockoutData}
      predictionMap={predictionObj}
      groupLeaders={groupLeadersObj}
      topScorers={topScorers}
      lastSynced={lastSynced}
    />
  )
}
