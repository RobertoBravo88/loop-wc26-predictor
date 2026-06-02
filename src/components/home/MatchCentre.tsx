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
  currentMatchIndex?: number   // 0-based, default 0
  totalMatches?: number        // total simultaneous matches, default 1
  onPrev?: () => void
  onNext?: () => void
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

// ============================================================
// Component
// ============================================================

const CARD_SHOW = 5

export default function MatchCentre({
  data,
  currentUserId,
  currentMatchIndex = 0,
  totalMatches = 1,
  onPrev,
  onNext,
}: MatchCentreProps) {
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

  const blurStyle = revealed
    ? { filter: 'blur(0)' }
    : { filter: 'blur(6px)', userSelect: 'none' as const, pointerEvents: 'none' as const }
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

  // Card sections: On the Ball | Happy Fans | Remontada?
  const cardOrder: PredStatus[] = ['on_ball', 'happy', 'still_in']

  // Nav button style
  const navBtnStyle: React.CSSProperties = {
    background: 'none',
    border: '1px solid rgba(255,255,255,0.2)',
    color: '#ffffff',
    fontFamily: sans,
    fontSize: '1rem',
    lineHeight: 1,
    width: 24,
    height: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 0,
  }

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
        {/* ── Header bar ── */}
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

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* Match navigation */}
            {totalMatches > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={onPrev} style={navBtnStyle}>‹</button>
                <span style={{ fontSize: '0.65rem', color: '#9ca3af', fontFamily: sans }}>
                  {currentMatchIndex + 1} of {totalMatches}
                </span>
                <button onClick={onNext} style={navBtnStyle}>›</button>
              </div>
            )}

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
        </div>

        {/* ── Scoreboard: diagonal split ── */}
        <div
          style={{
            background: '#0d0d0d',
            position: 'relative',
            overflow: 'hidden',
            minHeight: 180,
          }}
        >
          {/* Left panel — home team */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '50%',
              height: '100%',
              background: homeColors.accent,
              clipPath: 'polygon(0 0, 100% 0, 85% 100%, 0 100%)',
            }}
          >
            {/* Glow behind flag */}
            <div
              style={{
                position: 'absolute',
                width: 200,
                height: 200,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)',
                top: '50%',
                left: 80,
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'none',
              }}
            />
            {/* Content */}
            <div
              style={{
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                height: '100%',
                padding: '20px 20px 20px 20px',
                gap: 8,
              }}
            >
              {match.home_team.flag_url && (
                <img
                  src={match.home_team.flag_url}
                  alt=""
                  style={{
                    height: 80,
                    width: 'auto',
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.5))',
                    maxWidth: 120,
                  }}
                />
              )}
              <div
                style={{
                  fontFamily: sans,
                  fontSize: '1.4rem',
                  fontWeight: 800,
                  color: '#ffffff',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  lineHeight: 1.1,
                }}
              >
                {match.home_team.name}
              </div>
              {homeFans.length > 0 && (
                <div
                  style={{
                    fontFamily: sans,
                    fontSize: '0.65rem',
                    color: 'rgba(255,255,255,0.7)',
                    letterSpacing: '0.02em',
                  }}
                >
                  {homeFans.map(f => f.displayName).join(' · ')}
                </div>
              )}
            </div>
          </div>

          {/* Right panel — away team */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: '50%',
              height: '100%',
              background: awayColors.accent,
              clipPath: 'polygon(15% 0, 100% 0, 100% 100%, 0 100%)',
            }}
          >
            {/* Glow behind flag */}
            <div
              style={{
                position: 'absolute',
                width: 200,
                height: 200,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)',
                top: '50%',
                right: 80,
                transform: 'translate(50%, -50%)',
                pointerEvents: 'none',
              }}
            />
            {/* Content */}
            <div
              style={{
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                justifyContent: 'center',
                height: '100%',
                padding: '20px 20px 20px 20px',
                gap: 8,
              }}
            >
              {match.away_team.flag_url && (
                <img
                  src={match.away_team.flag_url}
                  alt=""
                  style={{
                    height: 80,
                    width: 'auto',
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.5))',
                    maxWidth: 120,
                  }}
                />
              )}
              <div
                style={{
                  fontFamily: sans,
                  fontSize: '1.4rem',
                  fontWeight: 800,
                  color: '#ffffff',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  lineHeight: 1.1,
                  textAlign: 'right',
                }}
              >
                {match.away_team.name}
              </div>
              {awayFans.length > 0 && (
                <div
                  style={{
                    fontFamily: sans,
                    fontSize: '0.65rem',
                    color: 'rgba(255,255,255,0.7)',
                    letterSpacing: '0.02em',
                    textAlign: 'right',
                  }}
                >
                  {awayFans.map(f => f.displayName).join(' · ')}
                </div>
              )}
            </div>
          </div>

          {/* Center overlay — score */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2,
              padding: '16px 0',
              background: 'radial-gradient(ellipse 200px 100% at center, rgba(0,0,0,0.7) 0%, transparent 100%)',
              minWidth: 160,
            }}
          >
            {/* Group / venue */}
            <div
              style={{
                fontFamily: sans,
                fontSize: '0.6rem',
                color: 'rgba(255,255,255,0.45)',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                marginBottom: 6,
                textAlign: 'center',
                whiteSpace: 'nowrap',
              }}
            >
              {match.group_letter ? `Group ${match.group_letter}` : ''}
              {match.venue ? ` · ${match.venue}` : ''}
            </div>

            {/* Score */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <span
                style={{
                  fontFamily: sans,
                  fontSize: '5rem',
                  fontWeight: 900,
                  color: '#ffffff',
                  lineHeight: 1,
                }}
              >
                {state === 'upcoming' ? '–' : currentHome}
              </span>
              <span
                style={{
                  fontFamily: sans,
                  fontSize: '2rem',
                  color: 'rgba(255,255,255,0.3)',
                  fontWeight: 300,
                }}
              >
                –
              </span>
              <span
                style={{
                  fontFamily: sans,
                  fontSize: '5rem',
                  fontWeight: 900,
                  color: '#ffffff',
                  lineHeight: 1,
                }}
              >
                {state === 'upcoming' ? '–' : currentAway}
              </span>
            </div>

            {/* Goal scorers */}
            {(state === 'live' || state === 'finished' || state === 'preview') && goalEvents.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center', gap: 20 }}>
                <div style={{ textAlign: 'right' }}>
                  {allHomeGoals.map(g => (
                    <div
                      key={g.id}
                      style={{
                        fontFamily: sans,
                        fontSize: '0.65rem',
                        color: 'rgba(255,255,255,0.65)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {g.minute != null ? `'${g.minute}` : ''} {g.player_name ?? '—'}
                      {g.is_own_goal ? ' (og)' : ''}
                    </div>
                  ))}
                </div>
                {allHomeGoals.length > 0 && allAwayGoals.length > 0 && (
                  <div style={{ width: 1, background: 'rgba(255,255,255,0.15)', alignSelf: 'stretch' }} />
                )}
                <div style={{ textAlign: 'left' }}>
                  {allAwayGoals.map(g => (
                    <div
                      key={g.id}
                      style={{
                        fontFamily: sans,
                        fontSize: '0.65rem',
                        color: 'rgba(255,255,255,0.65)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {g.player_name ?? '—'}
                      {g.is_own_goal ? ' (og)' : ''} {g.minute != null ? `'${g.minute}` : ''}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Prediction distribution bar — three solid blocks ── */}
        {predictions.length > 0 && (
          <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid #e0dbd3' }}>
            <div
              style={{
                flex: homePct || 1,
                background: homeColors.accent,
                padding: '8px 12px',
                minWidth: homePct > 0 ? 60 : 0,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', fontFamily: sans }}>
                {homePct}%
              </span>
              <span
                style={{
                  fontSize: '0.6rem',
                  color: 'rgba(255,255,255,0.75)',
                  marginLeft: 6,
                  textTransform: 'uppercase',
                  fontFamily: sans,
                  whiteSpace: 'nowrap',
                }}
              >
                {match.home_team.name} WIN
              </span>
            </div>
            {drawPct > 0 && (
              <div
                style={{
                  flex: drawPct,
                  background: 'rgba(80,80,80,0.85)',
                  padding: '8px 12px',
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', fontFamily: sans }}>
                  {drawPct}%
                </span>
                <span
                  style={{
                    fontSize: '0.6rem',
                    color: 'rgba(255,255,255,0.6)',
                    marginLeft: 6,
                    textTransform: 'uppercase',
                    fontFamily: sans,
                  }}
                >
                  DRAW
                </span>
              </div>
            )}
            <div
              style={{
                flex: awayPct || 1,
                background: awayColors.accent,
                padding: '8px 12px',
                textAlign: 'right',
                minWidth: awayPct > 0 ? 60 : 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
              }}
            >
              <span
                style={{
                  fontSize: '0.6rem',
                  color: 'rgba(255,255,255,0.75)',
                  marginRight: 6,
                  textTransform: 'uppercase',
                  fontFamily: sans,
                  whiteSpace: 'nowrap',
                }}
              >
                {match.away_team.name} WIN
              </span>
              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', fontFamily: sans }}>
                {awayPct}%
              </span>
            </div>
          </div>
        )}

        {/* ── Blurred section: predictions ── */}
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

          {/* Three-card prediction layout */}
          {sortedPreds.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 0,
                borderTop: '1px solid #e0dbd3',
              }}
            >
              {cardOrder.map((sectionStatus, colIdx) => {
                const accent = statusAccent(sectionStatus)
                const sectionPreds = sortedPreds.filter(p => p.status === sectionStatus)
                const shown = sectionPreds.slice(0, CARD_SHOW)
                const overflow = sectionPreds.length - CARD_SHOW

                // For the Remontada card, append out preds at bottom when finished
                const isRemontadaCard = sectionStatus === 'still_in'

                return (
                  <div
                    key={sectionStatus}
                    style={{
                      background: '#ffffff',
                      borderLeft: colIdx > 0 ? '1px solid #e0dbd3' : undefined,
                      borderRight: colIdx < cardOrder.length - 1 ? undefined : undefined,
                    }}
                  >
                    {/* Card header */}
                    <div
                      style={{
                        borderLeft: `3px solid ${accent}`,
                        padding: '6px 12px',
                        borderBottom: '1px solid #e0dbd3',
                        background: '#faf9f6',
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

                    {/* Card rows */}
                    {shown.length === 0 ? (
                      <div
                        style={{
                          padding: '10px 12px',
                          fontFamily: sans,
                          fontSize: '0.7rem',
                          color: '#c0bab3',
                        }}
                      >
                        — no one yet
                      </div>
                    ) : (
                      shown.map(pred => {
                        const totalPts = pred.matchPoints + pred.squadPoints + pred.teamPoints
                        const isRising = risingIds.has(pred.userId)
                        const isMe = currentUserId != null && pred.userId === currentUserId
                        return (
                          <div
                            key={pred.userId}
                            className={isRising ? 'animate-rise' : undefined}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '6px 12px',
                              borderBottom: '1px solid #f0ece6',
                              borderLeft: isMe ? '3px solid #ff5c35' : undefined,
                              background: isMe ? 'rgba(255,92,53,0.04)' : undefined,
                              paddingLeft: isMe ? 9 : 12,
                              gap: 6,
                            }}
                          >
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <span
                                style={{
                                  fontFamily: sans,
                                  fontSize: '0.78rem',
                                  color: isMe ? '#ff5c35' : '#141414',
                                  fontWeight: isMe ? 700 : 400,
                                  display: 'block',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {pred.displayName}
                              </span>
                              <span
                                style={{
                                  fontFamily: sans,
                                  fontSize: '0.65rem',
                                  color: '#9ca3af',
                                  display: 'block',
                                }}
                              >
                                predicted {pred.predictedHome}–{pred.predictedAway}
                              </span>
                            </div>
                            <span
                              style={{
                                fontFamily: sans,
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                color: totalPts > 0 ? '#ff5c35' : '#9ca3af',
                                flexShrink: 0,
                              }}
                            >
                              {totalPts}
                            </span>
                          </div>
                        )
                      })
                    )}

                    {/* Overflow count */}
                    {overflow > 0 && (
                      <div
                        style={{
                          padding: '5px 12px',
                          fontFamily: sans,
                          fontSize: '0.65rem',
                          color: '#9ca3af',
                          borderBottom: '1px solid #f0ece6',
                        }}
                      >
                        ... and {overflow} more
                      </div>
                    )}

                    {/* Out preds appended to Remontada card */}
                    {isRemontadaCard && state === 'finished' && outPreds.length > 0 && (
                      <div>
                        <div
                          style={{
                            borderLeft: `3px solid ${statusAccent('out')}`,
                            padding: '6px 12px',
                            borderBottom: '1px solid #e0dbd3',
                            borderTop: '1px solid #e0dbd3',
                            background: '#faf9f6',
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
                        <div style={{ padding: '8px 12px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {outPreds.map(p => (
                            <span
                              key={p.userId}
                              style={{
                                fontFamily: sans,
                                fontSize: '0.7rem',
                                color: '#9ca3af',
                              }}
                            >
                              {p.displayName} {p.predictedHome}–{p.predictedAway}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Out ticker for non-finished states (live/preview/upcoming) */}
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
                <span
                  key={p.userId}
                  style={{
                    fontFamily: sans,
                    fontSize: '0.7rem',
                    color: '#9ca3af',
                    marginRight: i < outPreds.length - 1 ? 12 : 0,
                  }}
                >
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
