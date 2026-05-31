import { createClient } from '@/lib/supabase/server'
import { stageName } from '@/lib/utils'
import type { Match, Team, GroupStanding, MatchStage } from '@/types'

export const revalidate = 60

const GROUPS = ['A','B','C','D','E','F','G','H','I','J','K','L']
const KNOCKOUT_STAGES: MatchStage[] = ['round_of_32', 'round_of_16', 'quarter_final', 'semi_final', 'third_place', 'final']

// Official WC 2026 Round of 32 pairings, keyed by FIFA match number (73–88).
// Source: FIFA World Cup 2026 official bracket / Wikipedia knockout stage article.
// Slot format: 'X1' = Group X winner, 'X2' = Group X runner-up, '3rd' = best 3rd-place team.
const R32_SLOT_MAP: Record<number, [string, string]> = {
  73: ['A2', 'B2'],   // Runner-up A vs Runner-up B
  74: ['E1', '3rd'],  // Winner E vs best 3rd (from A/B/C/D/F)
  75: ['F1', 'C2'],   // Winner F vs Runner-up C
  76: ['C1', 'F2'],   // Winner C vs Runner-up F
  77: ['I1', '3rd'],  // Winner I vs best 3rd (from C/D/F/G/H)
  78: ['E2', 'I2'],   // Runner-up E vs Runner-up I
  79: ['A1', '3rd'],  // Winner A vs best 3rd (from C/E/F/H/I)
  80: ['L1', '3rd'],  // Winner L vs best 3rd (from E/H/I/J/K)
  81: ['D1', '3rd'],  // Winner D vs best 3rd (from B/E/F/I/J)
  82: ['G1', '3rd'],  // Winner G vs best 3rd (from A/E/H/I/J)
  83: ['K2', 'L2'],   // Runner-up K vs Runner-up L
  84: ['H1', 'J2'],   // Winner H vs Runner-up J
  85: ['B1', '3rd'],  // Winner B vs best 3rd (from E/F/G/I/J)
  86: ['J1', 'H2'],   // Winner J vs Runner-up H
  87: ['K1', '3rd'],  // Winner K vs best 3rd (from D/E/I/J/L)
  88: ['D2', 'G2'],   // Runner-up D vs Runner-up G
}

function resolveSlot(slot: string, leaders: Map<string, { p1?: string; p2?: string; complete: boolean }>): { label: string; team?: string; confirmed: boolean } {
  if (!slot || slot === '3rd') return { label: 'Best 3rd place', confirmed: false }
  const m = slot.match(/^([A-L])([12])$/)
  if (!m) return { label: slot, confirmed: false }
  const group = m[1], pos = m[2]
  const g = leaders.get(group)
  const team = pos === '1' ? g?.p1 : g?.p2
  return {
    label: `Group ${group} ${pos === '1' ? 'winner' : 'runner-up'}`,
    team,
    confirmed: g?.complete ?? false,
  }
}

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

function StandingsTable({ standings, label }: { standings: GroupStanding[]; label: string }) {
  return (
    <div style={{ border: '1px solid #e0dbd3', background: '#ffffff' }}>
      <div
        className="px-4 py-2 text-xs font-semibold uppercase tracking-wider"
        style={{ background: '#141414', color: '#ffffff', fontFamily: 'Inter, sans-serif' }}
      >
        {label}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid #e0dbd3' }}>
            <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>Team</th>
            <th className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-center" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>P</th>
            <th className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-center" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>W</th>
            <th className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-center" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>D</th>
            <th className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-center" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>L</th>
            <th className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-center" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>GD</th>
            <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-right" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row, i) => (
            <tr
              key={row.team.id}
              style={{
                borderBottom: '1px solid #e0dbd3',
                background: i % 2 === 0 ? '#ffffff' : '#faf9f6',
                borderLeft: i < 2 ? '3px solid #22c55e' : '3px solid transparent'
              }}
            >
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs w-4" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>{i + 1}</span>
                  {row.team.flag_url && <img src={row.team.flag_url} alt="" className="w-5 h-3.5 object-cover flex-shrink-0" />}
                  <span className="font-medium text-sm" style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}>{row.team.name}</span>
                </div>
              </td>
              <td className="px-2 py-2.5 text-center text-sm" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>{row.played}</td>
              <td className="px-2 py-2.5 text-center text-sm" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>{row.won}</td>
              <td className="px-2 py-2.5 text-center text-sm" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>{row.drawn}</td>
              <td className="px-2 py-2.5 text-center text-sm" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>{row.lost}</td>
              <td className="px-2 py-2.5 text-center text-sm" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
                {row.goal_difference > 0 ? `+${row.goal_difference}` : row.goal_difference}
              </td>
              <td className="px-4 py-2.5 text-right text-sm font-bold" style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}>{row.points}</td>
            </tr>
          ))}
          {!standings.length && (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-xs" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
                No data yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

interface SlotInfo { label: string; team?: string; confirmed: boolean }

function TeamRow({ match, side, slot, finished }: {
  match: Match
  side: 'home' | 'away'
  slot?: SlotInfo
  finished: boolean
}) {
  const team = side === 'home' ? match.home_team : match.away_team
  const score = side === 'home' ? match.home_score : match.away_score
  const oppScore = side === 'home' ? match.away_score : match.home_score
  const won = finished && score !== null && oppScore !== null && score > oppScore

  if (team) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-2" style={{ fontFamily: 'Inter, sans-serif', color: won ? '#141414' : '#6b6b6b', fontWeight: won ? 600 : 400 }}>
        {team.flag_url && <img src={team.flag_url} alt="" className="w-4 h-3 object-cover flex-shrink-0" />}
        <span className="truncate flex-1">{team.name}</span>
        {finished && <span className="ml-auto font-bold" style={{ color: '#ff5c35' }}>{score}</span>}
      </div>
    )
  }

  // No team yet — show slot label + current leader
  return (
    <div className="px-3 py-2" style={{ fontFamily: 'Inter, sans-serif', minHeight: '32px' }}>
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-semibold" style={{ color: '#141414' }}>{slot?.label ?? 'TBD'}</span>
      </div>
      {slot?.team && (
        <div className="text-xs mt-0.5 truncate" style={{ color: slot.confirmed ? '#141414' : '#b0a99f', fontStyle: slot.confirmed ? 'normal' : 'italic' }}>
          {slot.confirmed ? '✓ ' : ''}{slot.team}
        </div>
      )}
    </div>
  )
}

function MatchNode({ match, userPick, homeSlot, awaySlot }: {
  match: Match
  userPick?: { h: number; a: number }
  homeSlot?: SlotInfo
  awaySlot?: SlotInfo
}) {
  const finished = match.status === 'finished'
  const hasTeams = match.home_team && match.away_team
  return (
    <div className="w-full text-xs" style={{ border: '1px solid #e0dbd3', background: '#ffffff' }}>
      <div style={{ borderBottom: '1px solid #e0dbd3' }}>
        <TeamRow match={match} side="home" slot={homeSlot} finished={finished} />
      </div>
      <div style={{ borderBottom: userPick && hasTeams ? '1px solid #e0dbd3' : 'none' }}>
        <TeamRow match={match} side="away" slot={awaySlot} finished={finished} />
      </div>
      {userPick && hasTeams && (
        <div className="px-3 py-1.5" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
          Your pick: {userPick.h}–{userPick.a}
        </div>
      )}
    </div>
  )
}

export default async function GroupsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: teams } = await supabase.from('teams').select('*').order('name')
  const { data: matches } = await supabase
    .from('matches')
    .select('*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*)')
    .eq('stage', 'group')
    .order('kickoff_at')

  const { data: knockoutMatches } = await supabase
    .from('matches')
    .select('*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*)')
    .in('stage', KNOCKOUT_STAGES)
    .order('kickoff_at')

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

  const byStage = new Map<MatchStage, Match[]>()
  for (const m of (knockoutMatches as Match[] ?? [])) {
    if (!byStage.has(m.stage)) byStage.set(m.stage, [])
    byStage.get(m.stage)!.push(m)
  }

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
  const groupLeaders = new Map<string, { p1?: string; p2?: string; complete: boolean }>()
  for (const g of GROUPS) {
    const groupTeams = teamsByGroup.get(g) ?? []
    const groupMatches = matchesByGroup.get(g) ?? []
    const standings = computeStandings(groupMatches, groupTeams)
    const complete = groupMatches.length > 0 && groupMatches.every(m => m.status === 'finished')
    groupLeaders.set(g, { p1: standings[0]?.team.name, p2: standings[1]?.team.name, complete })
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* Page header */}
      <div className="mb-10 pb-4" style={{ borderBottom: '2px solid #141414' }}>
        <h1
          className="text-4xl"
          style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 900, color: '#141414' }}
        >
          Tournament
        </h1>
        <p className="text-xs uppercase tracking-wider mt-1" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
          Group standings &amp; knockout bracket
        </p>
      </div>

      {/* All groups grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {GROUPS.map(g => {
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

          return (
            <div key={g}>
              {/* Group header */}
              <div className="flex items-center gap-3 mb-4 pb-3" style={{ borderBottom: '1px solid #e0dbd3' }}>
                <span
                  className="w-9 h-9 flex items-center justify-center text-base text-white flex-shrink-0"
                  style={{ background: '#141414', fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 900 }}
                >
                  {g}
                </span>
                <h2
                  className="text-2xl"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, color: '#141414' }}
                >
                  Group {g}
                </h2>
              </div>

              {/* Standings tables */}
              <div className={`grid gap-4 ${user && hasPredictions ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                <StandingsTable standings={realStandings} label="Current Standings" />
                {user && hasPredictions && (
                  <StandingsTable standings={predictedStandings} label="Your Predicted Standings" />
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Knockout Bracket */}
      <div className="mt-16">
        <div className="mb-8 pb-4" style={{ borderBottom: '2px solid #141414' }}>
          <h2
            className="text-3xl"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 900, color: '#141414' }}
          >
            Knockout Stage
          </h2>
          <p className="text-xs uppercase tracking-wider mt-1" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
            Your picks vs. reality · scroll right to see all rounds
          </p>
        </div>

        <div className="overflow-x-auto pb-6">
          <div className="flex items-start gap-4" style={{ minWidth: 'max-content' }}>
            {KNOCKOUT_STAGES.map(stage => {
              const stageMatches = byStage.get(stage) ?? []
              // Column width varies by stage — R32 and R16 are wider to hold slot labels
              const colWidth = stage === 'round_of_32' || stage === 'round_of_16' ? 200 : 180

              return (
                <div key={stage} style={{ width: `${colWidth}px`, flexShrink: 0 }}>
                  {/* Stage header */}
                  <div
                    className="px-3 py-1.5 mb-3 text-center text-xs font-bold uppercase tracking-wider"
                    style={{
                      background: '#141414',
                      color: '#ffffff',
                      fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    {stageName(stage)}
                  </div>

                  {/* Matches */}
                  {stageMatches.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {stageMatches.map((match) => {
                        let homeSlot: SlotInfo | undefined
                        let awaySlot: SlotInfo | undefined
                        if (stage === 'round_of_32' && match.match_number != null) {
                          const slots = R32_SLOT_MAP[match.match_number]
                          if (slots) {
                            homeSlot = resolveSlot(slots[0], groupLeaders)
                            awaySlot = resolveSlot(slots[1], groupLeaders)
                          }
                        }
                        return (
                          <MatchNode
                            key={match.id}
                            match={match}
                            userPick={predictionMap.get(match.id)}
                            homeSlot={homeSlot}
                            awaySlot={awaySlot}
                          />
                        )
                      })}
                    </div>
                  ) : (
                    <div
                      className="flex items-center justify-center text-xs uppercase tracking-wider py-6"
                      style={{
                        border: '1px dashed #e0dbd3',
                        color: '#c4bfb8',
                        fontFamily: 'Inter, sans-serif',
                        minHeight: '60px',
                      }}
                    >
                      TBD
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
