'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { MatchCentreData } from '@/lib/matchCentre'

// ============================================================
// Re-export the prop types so page.tsx can use them
// ============================================================
export type { MatchCentreData }

interface MatchCentreProps {
  data: MatchCentreData | null
  currentUserId?: string | null
}

const serif = "'Playfair Display', Georgia, serif"
const sans = 'Inter, sans-serif'

// ============================================================
// Team colors
// ============================================================

const TEAM_COLORS: Record<string, { bg: string; accent: string }> = {
  // Group A
  'Mexico':             { bg: 'rgba(0,104,71,0.08)',    accent: '#006847' },
  'South Africa':       { bg: 'rgba(0,122,77,0.08)',    accent: '#007A4D' },
  'South Korea':        { bg: 'rgba(0,52,120,0.08)',    accent: '#003478' },
  'Czech Republic':     { bg: 'rgba(215,20,26,0.08)',   accent: '#D7141A' },
  // Group B
  'Canada':             { bg: 'rgba(255,0,0,0.08)',     accent: '#FF0000' },
  'Bosnia and Herzegovina': { bg: 'rgba(0,47,108,0.08)', accent: '#002F6C' },
  'Qatar':              { bg: 'rgba(141,27,61,0.08)',   accent: '#8D1B3D' },
  'Switzerland':        { bg: 'rgba(255,0,0,0.08)',     accent: '#FF0000' },
  // Group C
  'Brazil':             { bg: 'rgba(0,156,59,0.08)',    accent: '#009C3B' },
  'Morocco':            { bg: 'rgba(193,39,45,0.08)',   accent: '#C1272D' },
  'Haiti':              { bg: 'rgba(0,32,159,0.08)',    accent: '#00209F' },
  'Scotland':           { bg: 'rgba(0,94,184,0.08)',    accent: '#005EB8' },
  // Group D
  'United States':      { bg: 'rgba(191,10,48,0.08)',   accent: '#BF0A30' },
  'Australia':          { bg: 'rgba(0,0,139,0.08)',     accent: '#00008B' },
  'Paraguay':           { bg: 'rgba(213,43,30,0.08)',   accent: '#D52B1E' },
  'Turkey':             { bg: 'rgba(227,10,23,0.08)',   accent: '#E30A17' },
  // Group E
  'Germany':            { bg: 'rgba(30,30,30,0.07)',    accent: '#1a1a1a' },
  'Curaçao':            { bg: 'rgba(0,61,165,0.08)',    accent: '#003DA5' },
  "Côte d'Ivoire":      { bg: 'rgba(247,127,0,0.08)',   accent: '#F77F00' },
  'Ecuador':            { bg: 'rgba(0,53,128,0.08)',    accent: '#003580' },
  // Group F
  'Netherlands':        { bg: 'rgba(255,99,0,0.08)',    accent: '#FF6300' },
  'Japan':              { bg: 'rgba(188,0,45,0.08)',    accent: '#BC002D' },
  'Sweden':             { bg: 'rgba(0,106,167,0.08)',   accent: '#006AA7' },
  'Tunisia':            { bg: 'rgba(231,0,0,0.08)',     accent: '#E70000' },
  // Group G
  'Belgium':            { bg: 'rgba(239,51,64,0.08)',   accent: '#EF3340' },
  'Egypt':              { bg: 'rgba(206,17,0,0.08)',    accent: '#CE1100' },
  'Iran':               { bg: 'rgba(35,159,64,0.08)',   accent: '#239F40' },
  'New Zealand':        { bg: 'rgba(0,36,125,0.08)',    accent: '#00247D' },
  // Group H
  'Spain':              { bg: 'rgba(170,21,27,0.08)',   accent: '#AA151B' },
  'Cape Verde':         { bg: 'rgba(0,49,131,0.08)',    accent: '#003183' },
  'Uruguay':            { bg: 'rgba(91,164,207,0.1)',   accent: '#1D6FA4' },
  'Saudi Arabia':       { bg: 'rgba(0,98,51,0.08)',     accent: '#006233' },
  // Group I
  'France':             { bg: 'rgba(0,35,149,0.08)',    accent: '#002395' },
  'Senegal':            { bg: 'rgba(0,133,63,0.08)',    accent: '#00853F' },
  'Iraq':               { bg: 'rgba(0,122,61,0.08)',    accent: '#007A3D' },
  'Norway':             { bg: 'rgba(239,43,45,0.08)',   accent: '#EF2B2D' },
  // Group J
  'Argentina':          { bg: 'rgba(116,172,223,0.1)',  accent: '#74ACDF' },
  'Algeria':            { bg: 'rgba(0,98,51,0.08)',     accent: '#006233' },
  'Austria':            { bg: 'rgba(237,40,0,0.08)',    accent: '#ED2800' },
  'Jordan':             { bg: 'rgba(0,122,61,0.08)',    accent: '#007A3D' },
  // Group K
  'Portugal':           { bg: 'rgba(0,102,0,0.08)',     accent: '#006600' },
  'Congo DR':           { bg: 'rgba(0,127,255,0.08)',   accent: '#007FFF' },
  'Uzbekistan':         { bg: 'rgba(30,181,58,0.08)',   accent: '#1EB53A' },
  'Colombia':           { bg: 'rgba(252,209,22,0.1)',   accent: '#003087' },
  // Group L
  'England':            { bg: 'rgba(207,8,31,0.08)',    accent: '#CF081F' },
  'Croatia':            { bg: 'rgba(23,23,150,0.08)',   accent: '#171796' },
  'Ghana':              { bg: 'rgba(252,209,22,0.08)',  accent: '#006B3F' },
  'Panama':             { bg: 'rgba(213,20,26,0.08)',   accent: '#D5141A' },
}

function getTeamColors(name: string | null | undefined): { bg: string; accent: string } {
  if (!name) return { bg: 'rgba(100,100,100,0.06)', accent: '#6b6b6b' }
  return TEAM_COLORS[name] ?? { bg: 'rgba(100,100,100,0.06)', accent: '#6b6b6b' }
}

// ============================================================
// Helpers
// ============================================================

function formatCountdown(minutes: number): string {
  if (minutes < 1) return 'Less than a minute'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

type PredStatus = 'on_ball' | 'happy' | 'still_in' | 'out'

function statusLabel(s: PredStatus, matchState?: string): string {
  if (s === 'on_ball') return 'ON THE BALL'
  if (s === 'happy') return 'HAPPY FANS'
  if (s === 'still_in') return 'REMONTADA?'
  return matchState === 'finished' ? 'NO LUCK THIS TIME' : 'OUT'
}

function statusAccent(s: PredStatus): string {
  if (s === 'on_ball') return '#ff5c35'
  if (s === 'happy') return '#22c55e'
  if (s === 'still_in') return '#9ca3af'
  return '#9ca3af'
}

function statusBg(s: PredStatus): string {
  if (s === 'on_ball') return 'rgba(255,92,53,0.05)'
  if (s === 'happy') return 'rgba(34,197,94,0.05)'
  return 'rgba(156,163,175,0.05)'
}

// ============================================================
// Component
// ============================================================

export default function MatchCentre({ data, currentUserId }: MatchCentreProps) {
  const router = useRouter()

  // Auto-refresh every 2 minutes when live
  useEffect(() => {
    if (!data || data.state !== 'live') return
    const interval = setInterval(() => {
      router.refresh()
    }, 120_000)
    return () => clearInterval(interval)
  }, [data, router])

  // Blur reveal animation: revealed = true unless upcoming
  const [revealed, setRevealed] = useState<boolean>(
    data ? data.state !== 'upcoming' : false,
  )

  const prevState = useRef<string | undefined>(data?.state)
  useEffect(() => {
    if (prevState.current === 'upcoming' && data?.state !== 'upcoming') {
      setRevealed(true)
    }
    prevState.current = data?.state
  }, [data?.state])

  // Overtake animation: track prediction order changes
  type PredEntry = MatchCentreData['predictions'][number]
  const getSortedIds = (preds: PredEntry[]) =>
    [...preds]
      .filter(p => p.status !== 'out')
      .sort((a, b) => (b.matchPoints + b.squadPoints + b.teamPoints) - (a.matchPoints + a.squadPoints + a.teamPoints))
      .map(p => p.userId)

  const prevOrderRef = useRef<string[]>([])
  const [risingIds, setRisingIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!data) return
    const newOrder = getSortedIds(data.predictions)
    const prevOrder = prevOrderRef.current
    if (prevOrder.length > 0) {
      const movedUp = new Set<string>()
      newOrder.forEach((id, newIdx) => {
        const prevIdx = prevOrder.indexOf(id)
        if (prevIdx > newIdx) movedUp.add(id)
      })
      if (movedUp.size > 0) {
        setRisingIds(movedUp)
        setTimeout(() => setRisingIds(new Set()), 700)
      }
    }
    prevOrderRef.current = newOrder
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.predictions])

  if (!data) return null

  const { state, match, goalEvents, predictions, homeFans, awayFans, minutesUntilKickoff } = data

  const currentHome = match.home_score ?? 0
  const currentAway = match.away_score ?? 0

  // Separate goal events by team
  const homeGoals = goalEvents.filter(g => g.team_id === match.home_team.id && !g.is_own_goal)
  const awayGoals = goalEvents.filter(g => g.team_id === match.away_team.id && !g.is_own_goal)
  const ownGoalsHome = goalEvents.filter(g => g.team_id === match.away_team.id && g.is_own_goal)
  const ownGoalsAway = goalEvents.filter(g => g.team_id === match.home_team.id && g.is_own_goal)
  const allHomeGoals = [...homeGoals, ...ownGoalsHome]
  const allAwayGoals = [...awayGoals, ...ownGoalsAway]

  // Sort predictions by total points desc, exclude out
  const sortedPreds = [...predictions]
    .filter(p => p.status !== 'out')
    .sort((a, b) => (b.matchPoints + b.squadPoints + b.teamPoints) - (a.matchPoints + a.squadPoints + a.teamPoints))

  const outPreds = predictions.filter(p => p.status === 'out')

  // Sections: exclude 'out' (handled separately); hide 'out' section unless finished
  const sections: PredStatus[] = ['on_ball', 'happy', 'still_in']

  const blurStyle = revealed ? { filter: 'blur(0)' } : { filter: 'blur(6px)', userSelect: 'none' as const, pointerEvents: 'none' as const }
  const revealTransition = { transition: 'filter 0.8s ease-out' }

  const homeColors = getTeamColors(match.home_team.name)
  const awayColors = getTeamColors(match.away_team.name)

  // Prediction distribution
  const homeWins = predictions.filter(p => p.predictedHome > p.predictedAway).length
  const draws    = predictions.filter(p => p.predictedHome === p.predictedAway).length
  const awayWins = predictions.filter(p => p.predictedHome < p.predictedAway).length
  const total    = predictions.length
  const homePct  = total > 0 ? Math.round(homeWins / total * 100) : 0
  const drawPct  = total > 0 ? Math.round(draws    / total * 100) : 0
  const awayPct  = total > 0 ? Math.round(awayWins / total * 100) : 0

  return (
    <>
      {/* Keyframe for rise animation */}
      <style>{`
        @keyframes rise {
          0%   { transform: translateY(-8px); background: rgba(255,92,53,0.15); }
          100% { transform: translateY(0);    background: transparent; }
        }
        .animate-rise { animation: rise 0.6s ease-out; }
      `}</style>

      <section
        style={{
          background: '#ffffff',
          border: '1px solid #e0dbd3',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            background: '#141414',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span
            style={{
              fontFamily: serif,
              fontWeight: 700,
              fontSize: '1rem',
              color: '#ffffff',
              letterSpacing: '0.02em',
            }}
          >
            Loop Match Centre
          </span>

          {/* State badge */}
          {state === 'live' && (
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontFamily: sans,
                fontSize: '0.7rem',
                fontWeight: 700,
                color: '#ffffff',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
              Live
            </span>
          )}
          {state === 'upcoming' && (
            <span
              style={{
                fontFamily: sans,
                fontSize: '0.7rem',
                fontWeight: 600,
                color: '#9ca3af',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              Starts in {formatCountdown(minutesUntilKickoff)}
            </span>
          )}
          {state === 'preview' && (
            <span
              style={{
                fontFamily: sans,
                fontSize: '0.7rem',
                fontWeight: 600,
                color: '#facc15',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              Just kicked off
            </span>
          )}
          {state === 'finished' && (
            <span
              style={{
                fontFamily: sans,
                fontSize: '0.7rem',
                fontWeight: 700,
                color: '#9ca3af',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              Full Time
            </span>
          )}
        </div>

        {/* Scoreboard — dark gradient broadcast-style header */}
        <div
          style={{
            background: `linear-gradient(to right, ${homeColors.accent}55 0%, #141414 35%, #141414 65%, ${awayColors.accent}55 100%)`,
            borderBottom: '1px solid #2a2a2a',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Main scoreboard row */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '20px 24px', gap: 16 }}>

            {/* Home team */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 14 }}>
              {match.home_team.flag_url && (
                <img src={match.home_team.flag_url} alt="" style={{ width: 72, height: 50, objectFit: 'contain', flexShrink: 0, filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.4))' }} />
              )}
              <div>
                <div style={{ fontFamily: sans, fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1.1 }}>
                  {match.home_team.name}
                </div>
                {homeFans.length > 0 && (
                  <div style={{ marginTop: 4, fontFamily: sans, fontSize: '0.65rem', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.02em' }}>
                    {homeFans.map(f => f.displayName).join(' · ')}
                  </div>
                )}
              </div>
            </div>

            {/* Score center */}
            <div style={{ textAlign: 'center', flexShrink: 0, minWidth: 160 }}>
              <div style={{ fontFamily: sans, fontSize: '0.6rem', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>
                {match.group_letter ? `Group ${match.group_letter}` : ''}{match.venue ? ` · ${match.venue}` : ''}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <span style={{ fontFamily: serif, fontSize: '3.5rem', fontWeight: 900, color: '#ffffff', lineHeight: 1 }}>
                  {state === 'upcoming' ? '–' : currentHome}
                </span>
                <span style={{ fontFamily: sans, fontSize: '1.5rem', color: 'rgba(255,255,255,0.3)', fontWeight: 300 }}>–</span>
                <span style={{ fontFamily: serif, fontSize: '3.5rem', fontWeight: 900, color: '#ffffff', lineHeight: 1 }}>
                  {state === 'upcoming' ? '–' : currentAway}
                </span>
              </div>
              {/* Goal scorers */}
              {(state === 'live' || state === 'finished' || state === 'preview') && goalEvents.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center', gap: 20 }}>
                  <div style={{ textAlign: 'right' }}>
                    {allHomeGoals.map(g => (
                      <div key={g.id} style={{ fontFamily: sans, fontSize: '0.65rem', color: 'rgba(255,255,255,0.65)', whiteSpace: 'nowrap' }}>
                        {g.minute != null ? `'${g.minute}` : ''} {g.player_name ?? '—'}{g.is_own_goal ? ' (og)' : ''}
                      </div>
                    ))}
                  </div>
                  {allHomeGoals.length > 0 && allAwayGoals.length > 0 && (
                    <div style={{ width: 1, background: 'rgba(255,255,255,0.15)', alignSelf: 'stretch' }} />
                  )}
                  <div style={{ textAlign: 'left' }}>
                    {allAwayGoals.map(g => (
                      <div key={g.id} style={{ fontFamily: sans, fontSize: '0.65rem', color: 'rgba(255,255,255,0.65)', whiteSpace: 'nowrap' }}>
                        {g.player_name ?? '—'}{g.is_own_goal ? ' (og)' : ''} {g.minute != null ? `'${g.minute}` : ''}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Away team */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 14 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: sans, fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1.1 }}>
                  {match.away_team.name}
                </div>
                {awayFans.length > 0 && (
                  <div style={{ marginTop: 4, fontFamily: sans, fontSize: '0.65rem', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.02em' }}>
                    {awayFans.map(f => f.displayName).join(' · ')}
                  </div>
                )}
              </div>
              {match.away_team.flag_url && (
                <img src={match.away_team.flag_url} alt="" style={{ width: 72, height: 50, objectFit: 'contain', flexShrink: 0, filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.4))' }} />
              )}
            </div>
          </div>

          {/* Prediction distribution bar — inside the dark header */}
          {predictions.length > 0 && (
            <div style={{ padding: '0 24px 14px' }}>
              <div style={{ height: 4, display: 'flex', overflow: 'hidden', borderRadius: 2, marginBottom: 5, background: 'rgba(255,255,255,0.1)' }}>
                <div style={{ width: `${homePct}%`, background: homeColors.accent, transition: 'width 0.5s' }} />
                <div style={{ width: `${drawPct}%`, background: 'rgba(255,255,255,0.25)', transition: 'width 0.5s' }} />
                <div style={{ width: `${awayPct}%`, background: awayColors.accent, transition: 'width 0.5s' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', fontFamily: sans, color: 'rgba(255,255,255,0.5)' }}>
                <span><strong style={{ color: 'rgba(255,255,255,0.85)' }}>{homePct}%</strong> {match.home_team.name}</span>
                <span><strong style={{ color: 'rgba(255,255,255,0.85)' }}>{drawPct}%</strong> Draw</span>
                <span>{match.away_team.name} <strong style={{ color: 'rgba(255,255,255,0.85)' }}>{awayPct}%</strong></span>
              </div>
            </div>
          )}
        </div>


        {/* Blurred section: predictions */}
        <div style={{ ...blurStyle, ...revealTransition }}>

          {/* Upcoming: prediction lock info */}
          {state === 'upcoming' && (
            <div
              style={{
                padding: '10px 16px',
                borderBottom: '1px solid #e0dbd3',
                background: '#faf9f6',
                textAlign: 'center',
              }}
            >
              <span style={{ fontFamily: sans, fontSize: '0.75rem', color: '#9ca3af' }}>
                Predictions reveal in {formatCountdown(minutesUntilKickoff)} · Locks in {formatCountdown(minutesUntilKickoff)}
              </span>
            </div>
          )}

          {/* Points table */}
          {sortedPreds.length > 0 && (
            <div>
              {/* Table header */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 52px 52px 52px 52px',
                  padding: '6px 16px',
                  borderBottom: '1px solid #e0dbd3',
                  background: '#f7f4ef',
                }}
              >
                <span style={{ fontFamily: sans, fontSize: '0.65rem', color: '#6b6b6b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Prediction</span>
                <span style={{ fontFamily: sans, fontSize: '0.65rem', color: '#6b6b6b', textAlign: 'center' }}>Match</span>
                <span style={{ fontFamily: sans, fontSize: '0.65rem', color: '#6b6b6b', textAlign: 'center' }}>Squad</span>
                <span style={{ fontFamily: sans, fontSize: '0.65rem', color: '#6b6b6b', textAlign: 'center' }}>Team</span>
                <span style={{ fontFamily: sans, fontSize: '0.65rem', color: '#6b6b6b', textAlign: 'center', fontWeight: 700 }}>Pts</span>
              </div>

              {sections.map(sectionStatus => {
                const sectionPreds = sortedPreds.filter(p => p.status === sectionStatus)
                if (sectionPreds.length === 0) return null
                const accent = statusAccent(sectionStatus)
                const bg = statusBg(sectionStatus)
                return (
                  <div key={sectionStatus}>
                    {/* Section header */}
                    <div
                      style={{
                        padding: '4px 16px',
                        background: bg,
                        borderBottom: '1px solid #e0dbd3',
                        borderLeft: `3px solid ${accent}`,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: sans,
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          color: accent,
                          textTransform: 'uppercase',
                          letterSpacing: '0.1em',
                        }}
                      >
                        {statusLabel(sectionStatus, state)}
                      </span>
                    </div>

                    {/* Rows */}
                    {sectionPreds.map(pred => {
                      const totalPts = pred.matchPoints + pred.squadPoints + pred.teamPoints
                      const isRising = risingIds.has(pred.userId)
                      const isMe = currentUserId != null && pred.userId === currentUserId
                      return (
                        <div
                          key={pred.userId}
                          className={isRising ? 'animate-rise' : undefined}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 52px 52px 52px 52px',
                            padding: '7px 16px',
                            borderBottom: '1px solid #f0ece6',
                            alignItems: 'center',
                            ...(isMe
                              ? {
                                  borderLeft: '3px solid #ff5c35',
                                  background: 'rgba(255, 92, 53, 0.04)',
                                  paddingLeft: 13,
                                }
                              : {}),
                          }}
                        >
                          <span
                            style={{
                              fontFamily: sans,
                              fontSize: '0.8rem',
                              color: isMe ? '#ff5c35' : '#141414',
                              fontWeight: isMe ? 700 : 400,
                            }}
                          >
                            {pred.displayName}
                            <span style={{ color: '#9ca3af', marginLeft: 6, fontWeight: 400 }}>
                              {pred.predictedHome}–{pred.predictedAway}
                            </span>
                          </span>
                          <span style={{ fontFamily: sans, fontSize: '0.8rem', textAlign: 'center', color: pred.matchPoints > 0 ? '#ff5c35' : '#9ca3af' }}>
                            {pred.matchPoints}
                          </span>
                          <span style={{ fontFamily: sans, fontSize: '0.8rem', textAlign: 'center', color: pred.squadPoints > 0 ? '#141414' : '#9ca3af' }}>
                            {pred.squadPoints}
                          </span>
                          <span style={{ fontFamily: sans, fontSize: '0.8rem', textAlign: 'center', color: pred.teamPoints > 0 ? '#141414' : '#9ca3af' }}>
                            {pred.teamPoints}
                          </span>
                          <span style={{ fontFamily: sans, fontSize: '0.8rem', textAlign: 'center', fontWeight: 700, color: '#ff5c35' }}>
                            {totalPts}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}

          {/* Out section — only shown when finished */}
          {state === 'finished' && outPreds.length > 0 && (
            <div>
              {/* Out section header */}
              <div
                style={{
                  padding: '4px 16px',
                  background: statusBg('out'),
                  borderBottom: '1px solid #e0dbd3',
                  borderLeft: `3px solid ${statusAccent('out')}`,
                }}
              >
                <span
                  style={{
                    fontFamily: sans,
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    color: statusAccent('out'),
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                  }}
                >
                  {statusLabel('out', state)}
                </span>
              </div>
              {/* Out rows */}
              <div
                style={{
                  padding: '8px 16px',
                  overflowX: 'auto',
                  whiteSpace: 'nowrap',
                }}
              >
                {outPreds.map((p, i) => (
                  <span key={p.userId} style={{ fontFamily: sans, fontSize: '0.7rem', color: '#9ca3af', marginRight: i < outPreds.length - 1 ? 12 : 0 }}>
                    {p.displayName} {p.predictedHome}–{p.predictedAway}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Out ticker for non-finished states */}
          {state !== 'finished' && outPreds.length > 0 && (
            <div
              style={{
                padding: '8px 16px',
                borderTop: '1px solid #e0dbd3',
                background: '#faf9f6',
                overflowX: 'auto',
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ fontFamily: sans, fontSize: '0.7rem', color: '#9ca3af', marginRight: 8 }}>
                Out of the match ·
              </span>
              {outPreds.map((p, i) => (
                <span key={p.userId} style={{ fontFamily: sans, fontSize: '0.7rem', color: '#9ca3af', marginRight: i < outPreds.length - 1 ? 12 : 0 }}>
                  {p.displayName} {p.predictedHome}–{p.predictedAway}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
