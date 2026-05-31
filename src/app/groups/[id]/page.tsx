import { createClient } from '@/lib/supabase/server'
import { formatKickoff } from '@/lib/utils'
import { notFound } from 'next/navigation'
import type { Match, Team, GroupStanding } from '@/types'

export const revalidate = 60

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

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const groupLetter = id.toUpperCase()
  if (!['A','B','C','D','E','F','G','H','I','J','K','L'].includes(groupLetter)) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: teams } = await supabase.from('teams').select('*').eq('group_letter', groupLetter)
  const { data: matches } = await supabase
    .from('matches')
    .select('*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*)')
    .eq('group_letter', groupLetter)
    .order('kickoff_at')

  const predictionMap = new Map<string, { h: number; a: number }>()
  if (user) {
    const matchIds = (matches ?? []).map(m => m.id)
    const { data: preds } = await supabase
      .from('predictions')
      .select('match_id, predicted_home, predicted_away')
      .eq('user_id', user.id)
      .in('match_id', matchIds)
    for (const p of preds ?? []) {
      predictionMap.set(p.match_id, { h: p.predicted_home, a: p.predicted_away })
    }
  }

  const castedMatches = (matches ?? []) as Match[]
  const castedTeams = (teams ?? []) as Team[]

  const realStandings = computeStandings(castedMatches, castedTeams)
  const predictedStandings = user ? computePredictedStandings(castedMatches, castedTeams, predictionMap) : []

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">

      {/* Page header */}
      <div className="mb-8 pb-4" style={{ borderBottom: '2px solid #141414' }}>
        <div className="flex items-center gap-3">
          <span
            className="w-10 h-10 flex items-center justify-center text-lg text-white"
            style={{ background: '#141414', fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 900 }}
          >
            {groupLetter}
          </span>
          <h1
            className="text-3xl"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, color: '#141414' }}
          >
            Group {groupLetter}
          </h1>
        </div>
      </div>

      {/* Standings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        <StandingsTable standings={realStandings} label="Current standings" />
        {user && predictedStandings.length > 0 && (
          <StandingsTable standings={predictedStandings} label="Your predicted standings" />
        )}
      </div>

      {/* Fixtures & Results */}
      <h2
        className="text-xl mb-4 pb-3"
        style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontWeight: 700,
          color: '#141414',
          borderBottom: '1px solid #e0dbd3'
        }}
      >
        Fixtures &amp; Results
      </h2>
      <div style={{ border: '1px solid #e0dbd3' }}>
        {castedMatches.map((match, idx) => (
          <div
            key={match.id}
            className="px-5 py-4"
            style={{
              background: idx % 2 === 0 ? '#ffffff' : '#faf9f6',
              borderBottom: idx < castedMatches.length - 1 ? '1px solid #e0dbd3' : 'none'
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
                {formatKickoff(match.kickoff_at)}
              </span>
              {match.status === 'finished' && (
                <span
                  className="text-xs font-semibold px-2 py-0.5 uppercase tracking-wider"
                  style={{ background: '#141414', color: '#ffffff', fontFamily: 'Inter, sans-serif' }}
                >
                  FT
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 flex-1 justify-end">
                <span className="text-sm font-semibold" style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}>
                  {match.home_team?.name}
                </span>
                {match.home_team?.flag_url && (
                  <img src={match.home_team.flag_url} alt="" className="w-6 h-4 object-cover flex-shrink-0" />
                )}
              </div>
              <div
                className="text-sm font-bold px-3 py-1 min-w-[60px] text-center text-white"
                style={{ background: '#141414', fontFamily: 'Inter, sans-serif' }}
              >
                {match.home_score !== null ? `${match.home_score} – ${match.away_score}` : 'vs'}
              </div>
              <div className="flex items-center gap-2 flex-1">
                {match.away_team?.flag_url && (
                  <img src={match.away_team.flag_url} alt="" className="w-6 h-4 object-cover flex-shrink-0" />
                )}
                <span className="text-sm font-semibold" style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}>
                  {match.away_team?.name}
                </span>
              </div>
            </div>
            {user && predictionMap.has(match.id) && (
              <p className="text-xs text-center mt-1.5" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
                Your pick: {predictionMap.get(match.id)!.h} – {predictionMap.get(match.id)!.a}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
