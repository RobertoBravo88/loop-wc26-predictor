import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { stageName } from '@/lib/utils'
import type { Match, Team, GroupStanding } from '@/types'

export const revalidate = 60

const serif = "'Playfair Display', Georgia, serif"
const sans  = 'Inter, sans-serif'

// Tournament starts June 11 2026 — fans are revealed from this date
const TOURNAMENT_START = new Date('2026-06-11T00:00:00Z')

const POSITION_ORDER = ['Goalkeeper', 'Defender', 'Midfielder', 'Forward']
const POSITION_SHORT: Record<string, string> = {
  Goalkeeper: 'GK',
  Defender:   'DF',
  Midfielder: 'MF',
  Forward:    'FW',
}

function computeStandings(matches: Match[], teams: Team[]): GroupStanding[] {
  const table = new Map<string, GroupStanding>()
  for (const t of teams) {
    table.set(t.id, {
      team: t, played: 0, won: 0, drawn: 0, lost: 0,
      goals_for: 0, goals_against: 0, goal_difference: 0, points: 0,
    })
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
    if (m.home_score > m.away_score)      { home.won++; home.points += 3; away.lost++ }
    else if (m.home_score < m.away_score) { away.won++; away.points += 3; home.lost++ }
    else                                  { home.drawn++; home.points++; away.drawn++; away.points++ }
  }
  return Array.from(table.values()).sort((a, b) =>
    b.points - a.points || b.goal_difference - a.goal_difference || b.goals_for - a.goals_for
  )
}

// ── Match card ─────────────────────────────────────────────────

function MatchCard({ match, teamId }: { match: Match; teamId: string }) {
  const isHome     = match.home_team_id === teamId
  const us         = isHome ? match.home_team  : match.away_team
  const them       = isHome ? match.away_team  : match.home_team
  const ourScore   = isHome ? match.home_score : match.away_score
  const theirScore = isHome ? match.away_score : match.home_score
  const finished   = match.status === 'finished'

  let result: 'W' | 'D' | 'L' | null = null
  if (finished && ourScore !== null && theirScore !== null) {
    if      (ourScore > theirScore) result = 'W'
    else if (ourScore < theirScore) result = 'L'
    else                            result = 'D'
  }

  const resultColor = result === 'W' ? '#16a34a' : result === 'L' ? '#dc2626' : '#ca8a04'
  const resultBg    = result === 'W' ? '#f0fdf4' : result === 'L' ? '#fef2f2' : '#fefce8'

  return (
    <div style={{ border: '1px solid #e0dbd3', background: '#ffffff' }}>
      {/* Stage label + date row */}
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{ background: '#faf9f6', borderBottom: '1px solid #e0dbd3' }}
      >
        <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: '#6b6b6b', fontFamily: sans }}>
          {match.stage === 'group'
            ? `Group ${match.group_letter}`
            : stageName(match.stage)}
        </span>
        <span className="text-xs" style={{ color: '#6b6b6b', fontFamily: sans }}>
          {format(new Date(match.kickoff_at), 'd MMM · HH:mm')}
        </span>
      </div>

      {/* Teams + score row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Opponent */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {them?.flag_url && (
            <img src={them.flag_url} alt="" className="w-6 h-4 object-contain flex-shrink-0" />
          )}
          <div className="min-w-0">
            {them ? (
              <Link
                href={`/teams/${them.id}`}
                className="text-sm font-semibold hover:underline truncate block"
                style={{ color: '#141414', fontFamily: sans }}
              >
                {them.name}
              </Link>
            ) : (
              <span className="text-sm" style={{ color: '#b0a99f', fontFamily: sans }}>TBD</span>
            )}
            <span className="text-xs" style={{ color: '#6b6b6b', fontFamily: sans }}>
              {isHome ? 'Home' : 'Away'}
            </span>
          </div>
        </div>

        {/* Score / TBD */}
        <div className="text-center flex-shrink-0 min-w-[80px]">
          {finished && ourScore !== null && theirScore !== null ? (
            <div
              className="inline-flex items-center gap-1 px-3 py-1"
              style={{ background: '#141414' }}
            >
              <span className="text-base font-bold text-white" style={{ fontFamily: serif }}>
                {ourScore}
              </span>
              <span className="text-sm text-white opacity-40" style={{ fontFamily: sans }}>–</span>
              <span className="text-base font-bold text-white" style={{ fontFamily: serif }}>
                {theirScore}
              </span>
            </div>
          ) : (
            <span className="text-xs uppercase tracking-wider" style={{ color: '#b0a99f', fontFamily: sans }}>
              TBD
            </span>
          )}
        </div>

        {/* W/D/L badge */}
        <div className="flex-shrink-0 w-8 text-center">
          {result && (
            <span
              className="inline-block w-7 h-7 text-center leading-7 text-xs font-bold"
              style={{ background: resultBg, color: resultColor, fontFamily: sans }}
            >
              {result}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: team } = await supabase
    .from('teams')
    .select('*, manager')
    .eq('id', id)
    .single()

  if (!team) notFound()

  const [playersRes, teamMatchesRes, groupTeamsRes, allGroupMatchesRes, fansRes] = await Promise.all([
    supabase
      .from('players')
      .select('id, name, position, shirt_number, photo_url, age, club')
      .eq('team_id', id)
      .order('name'),
    supabase
      .from('matches')
      .select('*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*)')
      .or(`home_team_id.eq.${id},away_team_id.eq.${id}`)
      .order('kickoff_at'),
    team.group_letter
      ? supabase.from('teams').select('*').eq('group_letter', team.group_letter)
      : Promise.resolve({ data: [] as Team[] }),
    team.group_letter
      ? supabase
          .from('matches')
          .select('*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*)')
          .eq('stage', 'group')
          .eq('group_letter', team.group_letter)
          .order('kickoff_at')
      : Promise.resolve({ data: [] as Match[] }),
    supabase
      .from('profiles')
      .select('id, display_name, total_points')
      .eq('favourite_team_id', id)
      .order('total_points', { ascending: false }),
  ])

  const players         = playersRes.data ?? []
  const teamMatches     = (teamMatchesRes.data ?? []) as Match[]
  const groupTeams      = (groupTeamsRes.data ?? []) as Team[]
  const allGroupMatches = (allGroupMatchesRes.data ?? []) as Match[]
  const fans            = fansRes.data ?? []
  const tournamentLive  = new Date() >= TOURNAMENT_START

  const groupMatches   = teamMatches.filter(m => m.stage === 'group')
  const knockoutMatches = teamMatches.filter(m => m.stage !== 'group')

  // Group standings
  const standings  = team.group_letter ? computeStandings(allGroupMatches, groupTeams) : []
  const myStanding = standings.find(s => s.team.id === id)
  const myRank     = myStanding ? standings.indexOf(myStanding) + 1 : null

  // Squad grouped by position
  const byPosition = new Map<string, typeof players>()
  for (const pos of POSITION_ORDER) byPosition.set(pos, [])
  byPosition.set('Other', [])
  for (const p of players) {
    const pos = POSITION_ORDER.includes(p.position ?? '') ? p.position! : 'Other'
    byPosition.get(pos)!.push(p)
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

      {/* Back link */}
      <Link
        href="/groups"
        className="inline-flex items-center gap-1 text-xs uppercase tracking-wider mb-6"
        style={{ color: '#6b6b6b', fontFamily: sans }}
      >
        ← Tournament
      </Link>

      {/* ── Hero header ───────────────────────────────── */}
      <div className="mb-6 p-6 sm:p-8" style={{ background: '#141414' }}>
        <div className="flex items-center gap-5 sm:gap-8">

          {/* Flag */}
          {team.flag_url && (
            <img
              src={team.flag_url}
              alt={team.name}
              className="w-20 h-14 sm:w-28 sm:h-20 object-contain flex-shrink-0"
              style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))' }}
            />
          )}

          {/* Name + group */}
          <div className="flex-1 min-w-0">
            <h1
              className="text-3xl sm:text-5xl text-white leading-tight"
              style={{ fontFamily: serif, fontWeight: 900 }}
            >
              {team.name}
            </h1>
            <p className="text-sm mt-1.5 uppercase tracking-widest" style={{ color: '#6b6b6b', fontFamily: sans }}>
              {team.group_letter && (
                <>
                  Group {team.group_letter}
                  {myRank && <span style={{ color: '#ff5c35' }}> · #{myRank} in group</span>}
                </>
              )}
              {(team as any).manager && (
                <span style={{ color: '#9ca3af' }}>
                  {team.group_letter ? ' · ' : ''}Coach: {(team as any).manager}
                </span>
              )}
            </p>
          </div>

          {/* W/D/L quick stats (desktop) */}
          {myStanding && (
            <div className="hidden sm:grid grid-cols-4 gap-5 text-center flex-shrink-0">
              {[
                { label: 'W', value: myStanding.won },
                { label: 'D', value: myStanding.drawn },
                { label: 'L', value: myStanding.lost },
                { label: 'Pts', value: myStanding.points },
              ].map(s => (
                <div key={s.label}>
                  <div
                    className="text-2xl font-bold"
                    style={{ color: s.label === 'Pts' ? '#ff5c35' : '#ffffff', fontFamily: serif }}
                  >
                    {s.value}
                  </div>
                  <div className="text-xs uppercase tracking-wider mt-0.5" style={{ color: '#6b6b6b', fontFamily: sans }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mobile stats */}
        {myStanding && (
          <div className="grid grid-cols-4 gap-3 mt-5 pt-4 sm:hidden" style={{ borderTop: '1px solid #2a2a2a' }}>
            {[
              { label: 'W', value: myStanding.won },
              { label: 'D', value: myStanding.drawn },
              { label: 'L', value: myStanding.lost },
              { label: 'Pts', value: myStanding.points },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className="text-xl font-bold" style={{ color: s.label === 'Pts' ? '#ff5c35' : '#ffffff', fontFamily: serif }}>
                  {s.value}
                </div>
                <div className="text-xs uppercase tracking-wider" style={{ color: '#6b6b6b', fontFamily: sans }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Standings + Matches grid ──────────────────────── */}
      <div className={`grid grid-cols-1 gap-6 mb-6 ${standings.length > 0 ? 'lg:grid-cols-5' : ''}`}>

        {/* ── Group standings (2/5) ── */}
        {standings.length > 0 && (
          <div className="lg:col-span-2">
            <h2
              className="text-xs font-bold uppercase tracking-wider mb-3"
              style={{ color: '#141414', fontFamily: sans }}
            >
              Group {team.group_letter} Standings
            </h2>
            <div style={{ background: '#ffffff', border: '1px solid #e0dbd3' }}>
            <table className="w-full">
              <thead>
                <tr style={{ background: '#faf9f6', borderBottom: '1px solid #e0dbd3' }}>
                  {[
                    { label: '#',    align: 'center' },
                    { label: 'Team', align: 'left'   },
                    { label: 'P',    align: 'center' },
                    { label: 'W',    align: 'center' },
                    { label: 'D',    align: 'center' },
                    { label: 'L',    align: 'center' },
                    { label: 'GD',   align: 'center' },
                    { label: 'Pts',  align: 'center' },
                  ].map(h => (
                    <th
                      key={h.label}
                      className={`px-2 py-2 text-xs font-semibold uppercase tracking-wider text-${h.align}`}
                      style={{ color: '#6b6b6b', fontFamily: sans }}
                    >
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {standings.map((row, i) => {
                  const isThis = row.team.id === id
                  return (
                    <tr
                      key={row.team.id}
                      style={{
                        borderBottom: '1px solid #e0dbd3',
                        background: isThis ? '#fff8f0' : i % 2 === 0 ? '#ffffff' : '#faf9f6',
                        borderLeft: isThis
                          ? '3px solid #ff5c35'
                          : i < 2
                          ? '3px solid #22c55e'
                          : '3px solid transparent',
                      }}
                    >
                      <td className="px-2 py-2.5 text-center text-xs" style={{ color: '#6b6b6b', fontFamily: sans }}>{i + 1}</td>
                      <td className="px-2 py-2.5">
                        <Link href={`/teams/${row.team.id}`} className="flex items-center gap-2 group">
                          {row.team.flag_url && (
                            <img src={row.team.flag_url} alt="" className="w-5 h-3.5 object-contain flex-shrink-0" />
                          )}
                          <span
                            className="text-xs font-medium group-hover:underline truncate"
                            style={{ color: isThis ? '#ff5c35' : '#141414', fontFamily: sans }}
                          >
                            {row.team.name}
                          </span>
                        </Link>
                      </td>
                      <td className="px-1 py-2.5 text-center text-xs" style={{ color: '#6b6b6b', fontFamily: sans }}>{row.played}</td>
                      <td className="px-1 py-2.5 text-center text-xs" style={{ color: '#6b6b6b', fontFamily: sans }}>{row.won}</td>
                      <td className="px-1 py-2.5 text-center text-xs" style={{ color: '#6b6b6b', fontFamily: sans }}>{row.drawn}</td>
                      <td className="px-1 py-2.5 text-center text-xs" style={{ color: '#6b6b6b', fontFamily: sans }}>{row.lost}</td>
                      <td className="px-1 py-2.5 text-center text-xs" style={{ color: '#6b6b6b', fontFamily: sans }}>
                        {row.goal_difference > 0 ? `+${row.goal_difference}` : row.goal_difference}
                      </td>
                      <td
                        className="px-1 py-2.5 text-center text-xs font-bold"
                        style={{ color: isThis ? '#ff5c35' : '#141414', fontFamily: sans }}
                      >
                        {row.points}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {/* ── Matches (3/5) ── */}
        <div className={`${standings.length > 0 ? 'lg:col-span-3' : ''} space-y-6`}>

          {/* Group stage matches */}
          {groupMatches.length > 0 && (
            <div>
              <h2
                className="text-xs font-bold uppercase tracking-wider mb-3"
                style={{ color: '#141414', fontFamily: sans }}
              >
                Group Stage
              </h2>
              <div className="space-y-2">
                {groupMatches.map(m => (
                  <MatchCard key={m.id} match={m} teamId={id} />
                ))}
              </div>
            </div>
          )}

          {/* Knockout matches */}
          {knockoutMatches.length > 0 && (
            <div>
              <h2
                className="text-xs font-bold uppercase tracking-wider mb-3"
                style={{ color: '#141414', fontFamily: sans }}
              >
                Knockout Stage
              </h2>
              <div className="space-y-2">
                {knockoutMatches.map(m => (
                  <MatchCard key={m.id} match={m} teamId={id} />
                ))}
              </div>
            </div>
          )}

          {teamMatches.length === 0 && (
            <div className="py-8 text-sm text-center" style={{ border: '1px solid #e0dbd3', color: '#6b6b6b', fontFamily: sans }}>
              No matches scheduled yet
            </div>
          )}
        </div>

      </div>

      {/* ── Squad — full width, one column per position ────── */}
      <div>
        <h2
          className="text-xs font-bold uppercase tracking-wider mb-3"
          style={{ color: '#141414', fontFamily: sans }}
        >
          Squad {players.length > 0 && `(${players.length})`}
        </h2>
        {players.length === 0 ? (
          <div className="py-8 text-sm text-center" style={{ border: '1px solid #e0dbd3', color: '#6b6b6b', fontFamily: sans }}>
            Squad not yet imported
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {POSITION_ORDER.map(pos => {
              const group = byPosition.get(pos) ?? []
              if (group.length === 0) return null
              return (
                <div key={pos} style={{ border: '1px solid #e0dbd3', background: '#ffffff' }}>
                  {/* Position header */}
                  <div
                    className="flex items-center justify-between px-4 py-2.5"
                    style={{ background: '#141414', borderBottom: '1px solid #2a2a2a' }}
                  >
                    <span className="text-xs font-bold uppercase tracking-widest text-white" style={{ fontFamily: sans }}>
                      {POSITION_SHORT[pos]}
                    </span>
                    <span className="text-xs" style={{ color: '#6b6b6b', fontFamily: sans }}>
                      {group.length} {pos.toLowerCase()}s
                    </span>
                  </div>

                  {/* Player cards */}
                  {group.map(p => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2.5 px-3 py-2"
                      style={{ borderBottom: '1px solid #f0ede8' }}
                    >
                      {/* Photo / initials avatar */}
                      <div
                        className="flex-shrink-0 rounded-full overflow-hidden flex items-center justify-center"
                        style={{
                          width: 32, height: 32,
                          background: (p as any).photo_url ? 'transparent' : '#e0dbd3',
                        }}
                      >
                        {(p as any).photo_url ? (
                          <img
                            src={(p as any).photo_url}
                            alt={p.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xs font-bold" style={{ color: '#6b6b6b', fontFamily: sans }}>
                            {p.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>

                      {/* Name + club */}
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-xs font-semibold leading-tight truncate"
                          style={{ color: '#141414', fontFamily: sans }}
                        >
                          {p.shirt_number != null && (
                            <span className="mr-1 font-normal" style={{ color: '#b0a99f' }}>
                              {p.shirt_number}
                            </span>
                          )}
                          {p.name}
                        </div>
                        {(p as any).club && (
                          <div
                            className="text-xs truncate leading-tight mt-0.5"
                            style={{ color: '#6b6b6b', fontFamily: sans }}
                          >
                            {(p as any).club}
                          </div>
                        )}
                      </div>

                      {/* Age */}
                      {(p as any).age && (
                        <span
                          className="flex-shrink-0 text-xs font-mono"
                          style={{ color: '#b0a99f', fontFamily: sans }}
                        >
                          {(p as any).age}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Fans ──────────────────────────────────────────── */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2
            className="text-xs font-bold uppercase tracking-wider"
            style={{ color: '#141414', fontFamily: sans }}
          >
            Fans {fans.length > 0 && `(${fans.length})`}
          </h2>
          {!tournamentLive && fans.length > 0 && (
            <span className="text-xs" style={{ color: '#b0a99f', fontFamily: sans }}>
              🔒 Revealed on 11 June
            </span>
          )}
        </div>

        {fans.length === 0 ? (
          <div
            className="py-6 text-sm text-center"
            style={{ border: '1px solid #e0dbd3', color: '#b0a99f', fontFamily: sans }}
          >
            No fans yet — be the first to support {team.name}
          </div>
        ) : (
          <div style={{ border: '1px solid #e0dbd3', background: '#ffffff' }}>
            {fans.map((fan, i) => {
              const isMe = fan.id === user?.id
              const revealed = tournamentLive || isMe

              return (
                <div
                  key={fan.id}
                  className="flex items-center gap-3 px-4 py-2.5"
                  style={{
                    borderBottom: '1px solid #f0ede8',
                    background: isMe ? '#fff8f0' : '#ffffff',
                    borderLeft: isMe ? '3px solid #ff5c35' : '3px solid transparent',
                  }}
                >
                  {/* Rank */}
                  <span
                    className="w-5 text-center text-xs flex-shrink-0"
                    style={{ color: '#b0a99f', fontFamily: sans }}
                  >
                    {i + 1}
                  </span>

                  {/* Avatar */}
                  <div
                    className="flex-shrink-0 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{
                      width: 28, height: 28,
                      background: isMe ? '#ff5c35' : '#e0dbd3',
                      color: isMe ? '#ffffff' : '#6b6b6b',
                      fontFamily: sans,
                      filter: revealed ? 'none' : 'blur(4px)',
                    }}
                  >
                    {revealed ? (fan.display_name?.[0] ?? '?').toUpperCase() : '?'}
                  </div>

                  {/* Name */}
                  <span
                    className="flex-1 text-sm font-medium truncate"
                    style={{
                      fontFamily: sans,
                      color: revealed ? '#141414' : 'transparent',
                      textShadow: revealed ? 'none' : '0 0 8px #6b6b6b',
                      userSelect: revealed ? 'auto' : 'none',
                    }}
                  >
                    {revealed ? fan.display_name : '●●●●●●●●'}
                  </span>

                  {/* Points */}
                  <span
                    className="text-xs font-mono flex-shrink-0"
                    style={{ color: revealed ? '#ff5c35' : '#e0dbd3', fontFamily: sans }}
                  >
                    {revealed ? `${fan.total_points ?? 0} pts` : '––'}
                  </span>

                  {/* You badge */}
                  {isMe && (
                    <span
                      className="text-xs px-2 py-0.5 flex-shrink-0"
                      style={{ background: '#ff5c35', color: '#ffffff', fontFamily: sans }}
                    >
                      you
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}
