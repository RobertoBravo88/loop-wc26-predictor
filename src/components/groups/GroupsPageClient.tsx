'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { stageName } from '@/lib/utils'
import { format } from 'date-fns'
import LocalTime from '@/components/ui/LocalTime'
import type { Match, GroupStanding, MatchStage } from '@/types'

// ============================================================
// Exported types (imported by groups/page.tsx)
// ============================================================

export interface GroupData {
  letter: string
  matches: Match[]
  realStandings: GroupStanding[]
  predictedStandings: GroupStanding[]  // empty array if user has no predictions
}

export interface KnockoutData {
  stage: MatchStage
  matches: Match[]
}

export interface TopScorer {
  id: string
  name: string
  teamName: string
  flagUrl: string | null
  goals: number
  isMyPick: boolean  // true if current user picked this player for Golden Boots
  isSecret: boolean  // true if this is the user's 12th Man secret player
}

interface SlotInfo { label: string; team?: string; confirmed: boolean }

interface Props {
  groupData: GroupData[]
  knockoutData: KnockoutData[]
  predictionMap: Record<string, { h: number; a: number }>
  groupLeaders: Record<string, { p1?: string; p2?: string; complete: boolean }>
  topScorers: TopScorer[]
  mySquadIds: string[]
  lastSynced: string | null
}

// ============================================================
// Constants
// ============================================================

const GROUPS = ['A','B','C','D','E','F','G','H','I','J','K','L']
const KNOCKOUT_STAGES: MatchStage[] = ['round_of_32', 'round_of_16', 'quarter_final', 'semi_final', 'third_place', 'final']
const PAGE_SIZE = 150

const R32_SLOT_MAP: Record<number, [string, string]> = {
  73: ['A2', 'B2'],
  74: ['E1', '3rd'],
  75: ['F1', 'C2'],
  76: ['C1', 'F2'],
  77: ['I1', '3rd'],
  78: ['E2', 'I2'],
  79: ['A1', '3rd'],
  80: ['L1', '3rd'],
  81: ['D1', '3rd'],
  82: ['G1', '3rd'],
  83: ['K2', 'L2'],
  84: ['H1', 'J2'],
  85: ['B1', '3rd'],
  86: ['J1', 'H2'],
  87: ['K1', '3rd'],
  88: ['D2', 'G2'],
}

// ============================================================
// Helper functions
// ============================================================

function resolveSlot(slot: string, leaders: Record<string, { p1?: string; p2?: string; complete: boolean }>): SlotInfo {
  if (!slot || slot === '3rd') return { label: 'Best 3rd place', confirmed: false }
  const m = slot.match(/^([A-L])([12])$/)
  if (!m) return { label: slot, confirmed: false }
  const group = m[1], pos = m[2]
  const g = leaders[group]
  const team = pos === '1' ? g?.p1 : g?.p2
  return {
    label: `Group ${group} ${pos === '1' ? 'winner' : 'runner-up'}`,
    team,
    confirmed: (g?.complete ?? false),
  }
}

// ============================================================
// Sub-components
// ============================================================

function StandingsTable({ standings, predictedStandings }: {
  standings: GroupStanding[]
  predictedStandings?: GroupStanding[]
}) {
  const hasPred = !!predictedStandings && predictedStandings.length > 0

  const predRankMap = new Map<string, number>()
  const predPtsMap  = new Map<string, number>()
  if (hasPred) {
    predictedStandings!.forEach((row, i) => {
      predRankMap.set(row.team.id, i + 1)
      predPtsMap.set(row.team.id, row.points)
    })
  }

  const thStyle = { color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }

  return (
    <div style={{ border: '1px solid #e0dbd3', background: '#ffffff' }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid #e0dbd3', background: '#faf9f6' }}>
            <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wider" style={thStyle}>Team</th>
            <th className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-center" style={thStyle}>P</th>
            <th className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-center hidden sm:table-cell" style={thStyle}>W</th>
            <th className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-center hidden sm:table-cell" style={thStyle}>D</th>
            <th className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-center hidden sm:table-cell" style={thStyle}>L</th>
            <th className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-center" style={thStyle}>GD</th>
            <th className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-center" style={thStyle}>Pts</th>
            {hasPred && (
              <th className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-center" style={{ ...thStyle, color: '#ff5c35' }}>
                My pts
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {standings.map((row, i) => {
            const actualRank = i + 1
            const predRank   = predRankMap.get(row.team.id)
            const predPts    = predPtsMap.get(row.team.id)
            const delta = predRank != null ? predRank - actualRank : null

            return (
              <tr
                key={row.team.id}
                style={{
                  borderBottom: '1px solid #e0dbd3',
                  background: i % 2 === 0 ? '#ffffff' : '#faf9f6',
                  borderLeft: i < 2 ? '3px solid #22c55e' : '3px solid transparent',
                }}
              >
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs w-4 flex-shrink-0 text-center" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>{actualRank}</span>
                    {row.team.flag_url && (
                      <img src={row.team.flag_url} alt="" className="w-5 h-3.5 object-contain flex-shrink-0" />
                    )}
                    <Link
                      href={`/teams/${row.team.id}`}
                      className="font-medium text-sm truncate hover:underline"
                      style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}
                    >
                      {row.team.name}
                    </Link>
                    {delta !== null && delta !== 0 && (
                      <span
                        className="flex-shrink-0 text-xs font-bold"
                        style={{ color: delta > 0 ? '#16a34a' : '#dc2626', fontFamily: 'Inter, sans-serif' }}
                      >
                        {delta > 0 ? `↑${delta}` : `↓${Math.abs(delta)}`}
                      </span>
                    )}
                    {delta === 0 && (
                      <span className="flex-shrink-0 text-xs" style={{ color: '#22c55e', fontFamily: 'Inter, sans-serif' }}>✓</span>
                    )}
                  </div>
                </td>
                <td className="px-2 py-2.5 text-center text-sm" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>{row.played}</td>
                <td className="px-2 py-2.5 text-center text-sm hidden sm:table-cell" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>{row.won}</td>
                <td className="px-2 py-2.5 text-center text-sm hidden sm:table-cell" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>{row.drawn}</td>
                <td className="px-2 py-2.5 text-center text-sm hidden sm:table-cell" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>{row.lost}</td>
                <td className="px-2 py-2.5 text-center text-sm" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
                  {row.goal_difference > 0 ? `+${row.goal_difference}` : row.goal_difference}
                </td>
                <td className="px-2 py-2.5 text-center text-sm font-bold" style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}>
                  {row.points}
                </td>
                {hasPred && (
                  <td className="px-2 py-2.5 text-center text-sm font-bold" style={{ color: '#ff5c35', fontFamily: 'Inter, sans-serif' }}>
                    {predPts ?? '–'}
                  </td>
                )}
              </tr>
            )
          })}
          {!standings.length && (
            <tr>
              <td colSpan={hasPred ? 8 : 7} className="px-4 py-6 text-center text-xs" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
                No data yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

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
        {team.flag_url && <img src={team.flag_url} alt="" className="w-4 h-3 object-contain flex-shrink-0" />}
        <Link href={`/teams/${team.id}`} className="truncate flex-1 hover:underline" style={{ color: 'inherit' }}>
          {team.name}
        </Link>
        {finished && <span className="ml-auto font-bold" style={{ color: '#ff5c35' }}>{score}</span>}
      </div>
    )
  }

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
          Your call: {userPick.h}–{userPick.a}
        </div>
      )}
    </div>
  )
}

// ============================================================
// All Matches tab component
// ============================================================

function AllMatchesTab({
  groupData,
  knockoutData,
  firstUpcomingRef,
}: {
  groupData: GroupData[]
  knockoutData: KnockoutData[]
  firstUpcomingRef: React.MutableRefObject<HTMLDivElement | null>
}) {
  // Combine all matches from group + knockout data
  const allMatches: Array<Match & { displayLabel: string }> = []

  for (const gd of groupData) {
    for (const m of gd.matches) {
      allMatches.push({ ...m, displayLabel: `Group ${gd.letter}` })
    }
  }
  for (const kd of knockoutData) {
    for (const m of kd.matches) {
      allMatches.push({ ...m, displayLabel: stageName(kd.stage) })
    }
  }

  // Sort chronologically
  allMatches.sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime())

  // Find first upcoming
  const now = new Date()
  const firstUpcomingIdx = allMatches.findIndex(m => m.status !== 'finished' && new Date(m.kickoff_at) >= now)

  // Scroll to first upcoming when tab activates
  useEffect(() => {
    if (firstUpcomingRef.current) {
      firstUpcomingRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [firstUpcomingRef])

  if (allMatches.length === 0) {
    return (
      <div className="text-center py-16 text-sm" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
        No matches loaded yet.
      </div>
    )
  }

  return (
    <div style={{ border: '1px solid #e0dbd3', background: '#ffffff' }}>
      {allMatches.map((match, idx) => {
        const finished = match.status === 'finished'
        const isFirstUpcoming = idx === firstUpcomingIdx
        return (
          <div
            key={match.id}
            ref={isFirstUpcoming ? firstUpcomingRef : undefined}
            className="flex items-center gap-3 px-4 py-3"
            style={{
              borderBottom: '1px solid #e0dbd3',
              borderLeft: finished ? '3px solid #22c55e' : '3px solid #e0dbd3',
              background: isFirstUpcoming ? '#faf9f6' : idx % 2 === 0 ? '#ffffff' : '#faf9f6',
            }}
          >
            {/* Label */}
            <span
              className="text-xs flex-shrink-0 w-24 truncate"
              style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}
            >
              {match.displayLabel}
            </span>

            {/* Home team */}
            <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0">
              <span className="text-sm font-semibold truncate" style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}>
                {match.home_team?.name ?? '—'}
              </span>
              {match.home_team?.flag_url && (
                <img src={match.home_team.flag_url} alt="" className="w-5 h-3.5 object-contain flex-shrink-0" />
              )}
            </div>

            {/* Score or time + date */}
            <div className="flex-shrink-0 mx-1 text-center">
              {finished && match.home_score !== null ? (
                <>
                  <span
                    className="text-xs font-bold px-2 py-1 block"
                    style={{ background: '#141414', color: '#ffffff', fontFamily: 'Inter, sans-serif' }}
                  >
                    {match.home_score} – {match.away_score}
                  </span>
                  <span className="text-xs block mt-0.5" style={{ color: '#9ca3af', fontFamily: 'Inter, sans-serif' }}>
                    <LocalTime date={match.kickoff_at} fmt="d MMM" />
                  </span>
                </>
              ) : (
                <>
                  <span className="text-xs font-semibold block" style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}>
                    <LocalTime date={match.kickoff_at} fmt="d MMM" />
                  </span>
                  <span className="text-xs block" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
                    <LocalTime date={match.kickoff_at} fmt="HH:mm" />
                  </span>
                </>
              )}
            </div>

            {/* Away team */}
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              {match.away_team?.flag_url && (
                <img src={match.away_team.flag_url} alt="" className="w-5 h-3.5 object-contain flex-shrink-0" />
              )}
              <span className="text-sm font-semibold truncate" style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}>
                {match.away_team?.name ?? '—'}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ============================================================
// Main client component
// ============================================================

export default function GroupsPageClient({
  groupData,
  knockoutData,
  predictionMap,
  groupLeaders,
  topScorers,
  mySquadIds,
  lastSynced,
}: Props) {
  const [tab, setTab] = useState<'groups' | 'finals' | 'scorers' | 'all'>('groups')
  const [standingsView, setStandingsView] = useState<'real' | 'predicted'>('real')
  const [scorerPage, setScorerPage] = useState(0)
  const [showMySquad, setShowMySquad] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTeam, setSelectedTeam] = useState('')
  const firstUpcomingRef = useRef<HTMLDivElement | null>(null)

  const knockoutByStage = new Map<MatchStage, Match[]>()
  for (const kd of knockoutData) {
    knockoutByStage.set(kd.stage, kd.matches)
  }

  // Build sorted list of unique team names for the dropdown
  const allTeamNames = [...new Set(topScorers.map(s => s.teamName).filter(Boolean))].sort()

  const hasSquad = mySquadIds.length > 0
  const filteredScorers = topScorers
    .filter(s => !showMySquad || mySquadIds.includes(s.id))
    .filter(s => !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter(s => !selectedTeam || s.teamName === selectedTeam)
  const totalScorerPages = Math.ceil(filteredScorers.length / PAGE_SIZE)
  const pagedScorers = filteredScorers.slice(scorerPage * PAGE_SIZE, (scorerPage + 1) * PAGE_SIZE)

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '12px 20px',
    fontSize: '0.875rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    whiteSpace: 'nowrap',
    background: 'none',
    border: 'none',
    borderBottom: active ? '2px solid #ff5c35' : '2px solid transparent',
    marginBottom: '-2px',
    color: active ? '#ff5c35' : '#6b6b6b',
    cursor: 'pointer',
    fontFamily: 'Inter, sans-serif',
  })

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
          {lastSynced && (
            <span style={{ color: '#c4bfb8' }}> &middot; Last updated {format(new Date(lastSynced), 'd MMM · HH:mm')}</span>
          )}
        </p>
      </div>

      {/* Tabs bar */}
      <div
        style={{
          borderBottom: '2px solid #e0dbd3',
          display: 'flex',
          overflowX: 'auto',
          overflowY: 'hidden',
          marginBottom: '2rem',
        }}
      >
        <button style={tabStyle(tab === 'groups')} onClick={() => setTab('groups')}>
          Group Stage
        </button>
        <button style={tabStyle(tab === 'finals')} onClick={() => setTab('finals')}>
          Finals
        </button>
        <button style={tabStyle(tab === 'scorers')} onClick={() => setTab('scorers')}>
          Top Scorers
        </button>
        <button style={tabStyle(tab === 'all')} onClick={() => setTab('all')}>
          All Matches
        </button>
      </div>

      {/* ── Group Stage tab ── */}
      {tab === 'groups' && (
        <>
          {/* Real / My Prediction toggle */}
          <div className="flex items-center gap-3 mb-6">
            <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
              Standings:
            </span>
            <div style={{ display: 'flex', border: '1px solid #e0dbd3', background: '#faf9f6' }}>
              <button
                onClick={() => setStandingsView('real')}
                style={{
                  padding: '6px 16px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  fontFamily: 'Inter, sans-serif',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  border: 'none',
                  cursor: 'pointer',
                  background: standingsView === 'real' ? '#141414' : 'transparent',
                  color: standingsView === 'real' ? '#ffffff' : '#6b6b6b',
                  transition: 'all 0.15s',
                }}
              >
                Real
              </button>
              <button
                onClick={() => setStandingsView('predicted')}
                style={{
                  padding: '6px 16px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  fontFamily: 'Inter, sans-serif',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  border: 'none',
                  borderLeft: '1px solid #e0dbd3',
                  cursor: 'pointer',
                  background: standingsView === 'predicted' ? '#ff5c35' : 'transparent',
                  color: standingsView === 'predicted' ? '#ffffff' : '#6b6b6b',
                  transition: 'all 0.15s',
                }}
              >
                My Prediction
              </button>
            </div>
            {standingsView === 'predicted' && (
              <span className="text-xs" style={{ color: '#ff5c35', fontFamily: 'Inter, sans-serif' }}>
                Based on your predicted match scores
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {groupData.map(gd => {
              const hasPred = gd.predictedStandings.length > 0
              const primary   = standingsView === 'predicted' && hasPred
                ? gd.predictedStandings
                : gd.realStandings
              const secondary = standingsView === 'real' && hasPred
                ? gd.predictedStandings
                : undefined

              return (
                <div key={gd.letter}>
                  <div className="flex items-center gap-3 mb-4 pb-3" style={{ borderBottom: '1px solid #e0dbd3' }}>
                    <span
                      className="w-9 h-9 flex items-center justify-center text-base text-white flex-shrink-0"
                      style={{ background: '#141414', fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 900 }}
                    >
                      {gd.letter}
                    </span>
                    <h2
                      className="text-2xl"
                      style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, color: '#141414' }}
                    >
                      Group {gd.letter}
                    </h2>
                  </div>

                  <StandingsTable
                    standings={primary}
                    predictedStandings={secondary}
                  />
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── Finals tab ── */}
      {tab === 'finals' && (
        <div className="overflow-x-auto pb-6">
          <div className="flex items-start gap-4" style={{ minWidth: 'max-content' }}>
            {KNOCKOUT_STAGES.map(stage => {
              const stageMatches = knockoutByStage.get(stage) ?? []
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
                            userPick={predictionMap[match.id]}
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
      )}

      {/* ── All Matches tab ── */}
      {tab === 'all' && (
        <AllMatchesTab
          groupData={groupData}
          knockoutData={knockoutData}
          firstUpcomingRef={firstUpcomingRef}
        />
      )}

      {/* ── Top Scorers tab ── */}
      {tab === 'scorers' && (
        <div>
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {/* Search */}
            <input
              type="text"
              placeholder="Search player…"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setScorerPage(0) }}
              style={{
                flex: '1 1 160px',
                minWidth: '160px',
                border: '1px solid #e0dbd3',
                background: '#ffffff',
                padding: '7px 11px',
                fontSize: '0.75rem',
                fontFamily: 'Inter, sans-serif',
                color: '#141414',
                outline: 'none',
              }}
            />
            {/* Team filter */}
            <select
              value={selectedTeam}
              onChange={e => { setSelectedTeam(e.target.value); setScorerPage(0) }}
              style={{
                flex: '1 1 140px',
                minWidth: '140px',
                border: '1px solid #e0dbd3',
                background: '#ffffff',
                padding: '7px 11px',
                fontSize: '0.75rem',
                fontFamily: 'Inter, sans-serif',
                color: selectedTeam ? '#141414' : '#6b6b6b',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="">All teams</option>
              {allTeamNames.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            {/* My Squad toggle */}
            {hasSquad && (
              <button
                onClick={() => { setShowMySquad(v => !v); setScorerPage(0) }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors flex-shrink-0"
                style={{
                  fontFamily: 'Inter, sans-serif',
                  border: `1px solid ${showMySquad ? '#ff5c35' : '#e0dbd3'}`,
                  background: showMySquad ? '#ff5c35' : '#ffffff',
                  color: showMySquad ? '#ffffff' : '#6b6b6b',
                  whiteSpace: 'nowrap',
                }}
              >
                👟 My Squad
              </button>
            )}
          </div>
          {/* Player count */}
          <div className="mb-4">
            <span className="text-xs uppercase tracking-wider" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
              {filteredScorers.length} player{filteredScorers.length !== 1 ? 's' : ''}
              {(searchQuery || selectedTeam) && (
                <button
                  onClick={() => { setSearchQuery(''); setSelectedTeam(''); setScorerPage(0) }}
                  className="ml-2 underline"
                  style={{ color: '#ff5c35', fontFamily: 'Inter, sans-serif', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem' }}
                >
                  Clear filters
                </button>
              )}
            </span>
          </div>

          {filteredScorers.length === 0 ? (
            <div
              className="flex items-center justify-center py-16"
              style={{ border: '1px solid #e0dbd3', background: '#ffffff' }}
            >
              <p className="text-sm text-center" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
                No squad picked yet — head to Tournament Picks to choose your players.
              </p>
            </div>
          ) : (
            <>
              {/* Table */}
              <div style={{ border: '1px solid #e0dbd3', background: '#ffffff' }}>
                {/* Header row */}
                <div
                  className="grid gap-3 px-4 py-2"
                  style={{
                    gridTemplateColumns: 'auto 1fr auto',
                    background: '#faf9f6',
                    borderBottom: '1px solid #e0dbd3',
                  }}
                >
                  <span className="w-8 text-center text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>#</span>
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>Football player</span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-right" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>Goals</span>
                </div>

                {/* Scorer rows */}
                {pagedScorers.map((scorer, i) => {
                  const globalRank = scorerPage * PAGE_SIZE + i + 1
                  const bg = scorer.isSecret
                    ? '#fefce8'
                    : scorer.isMyPick
                    ? '#fff8f0'
                    : (i % 2 === 0 ? '#ffffff' : '#faf9f6')
                  const border = scorer.isSecret
                    ? '3px solid #eab308'
                    : scorer.isMyPick
                    ? '3px solid #ff5c35'
                    : '3px solid transparent'

                  return (
                    <div
                      key={scorer.id}
                      className="grid gap-3 px-4 py-3 items-center"
                      style={{
                        gridTemplateColumns: 'auto 1fr auto',
                        borderBottom: '1px solid #e0dbd3',
                        background: bg,
                        borderLeft: border,
                      }}
                    >
                      {/* Rank */}
                      <span
                        className="w-8 text-center text-sm"
                        style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}
                      >
                        {globalRank}
                      </span>

                      {/* Player info */}
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          {scorer.flagUrl && (
                            <img src={scorer.flagUrl} alt="" className="w-5 h-3.5 object-contain flex-shrink-0" />
                          )}
                          <span className="font-semibold text-sm truncate" style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}>
                            {scorer.name}
                          </span>
                          {scorer.isSecret && (
                            <span className="flex-shrink-0" title="Your 12th Man player — 20pts per goal">⭐</span>
                          )}
                          {scorer.isMyPick && !scorer.isSecret && (
                            <span className="flex-shrink-0" title="Your Golden Boots pick — 10pts per goal">👟</span>
                          )}
                        </div>
                        <span className="text-xs mt-0.5" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
                          {scorer.teamName}
                          {scorer.isSecret && <span style={{ color: '#eab308' }}> · 20 pts/goal</span>}
                        </span>
                      </div>

                      {/* Goals */}
                      <span className="font-bold text-sm" style={{ color: '#ff5c35', fontFamily: 'Inter, sans-serif' }}>
                        {scorer.goals}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Pagination */}
              {totalScorerPages > 1 && (
                <div className="flex items-center justify-center gap-3 mt-6">
                  <button
                    onClick={() => setScorerPage(p => Math.max(0, p - 1))}
                    disabled={scorerPage === 0}
                    style={{
                      border: '1px solid #e0dbd3',
                      padding: '8px 16px',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      fontFamily: 'Inter, sans-serif',
                      background: '#ffffff',
                      color: '#141414',
                      cursor: scorerPage === 0 ? 'not-allowed' : 'pointer',
                      opacity: scorerPage === 0 ? 0.4 : 1,
                    }}
                  >
                    ← Prev
                  </button>
                  <span className="text-sm" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
                    {scorerPage + 1} / {totalScorerPages}
                  </span>
                  <button
                    onClick={() => setScorerPage(p => Math.min(totalScorerPages - 1, p + 1))}
                    disabled={scorerPage === totalScorerPages - 1}
                    style={{
                      border: '1px solid #e0dbd3',
                      padding: '8px 16px',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      fontFamily: 'Inter, sans-serif',
                      background: '#ffffff',
                      color: '#141414',
                      cursor: scorerPage === totalScorerPages - 1 ? 'not-allowed' : 'pointer',
                      opacity: scorerPage === totalScorerPages - 1 ? 0.4 : 1,
                    }}
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
