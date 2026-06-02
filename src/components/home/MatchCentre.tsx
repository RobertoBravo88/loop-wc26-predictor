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

// ============================================================
// Component
// ============================================================

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

  // Unified sorted prediction list
  const statusOrder: Record<string, number> = { on_ball: 0, happy: 1, still_in: 2, out: 3 }
  const allSortedPreds = [...predictions].sort((a, b) => {
    const so = statusOrder[a.status] - statusOrder[b.status]
    if (so !== 0) return so
    return (b.matchPoints + b.squadPoints + b.teamPoints) - (a.matchPoints + a.squadPoints + a.teamPoints)
  }).filter(p => state === 'finished' || p.status !== 'out')

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
          {/* Left: group + venue */}
          <span
            style={{
              fontFamily: sans,
              fontSize: '0.65rem',
              fontWeight: 600,
              color: '#9ca3af',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            {match.group_letter ? `GROUP ${match.group_letter}` : ''}
            {match.venue ? ` · ${match.venue}` : ''}
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

        {/* ── Scoreboard: badge overflow + score in panels ── */}
        <div style={{ position: 'relative', overflow: 'visible' }}>

          {/* Home badge — overflows left edge */}
          <div style={{ position: 'absolute', left: -20, top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}>
            {match.home_team.flag_url && (
              <img
                src={match.home_team.flag_url}
                alt=""
                style={{ width: 90, height: 90, objectFit: 'contain', filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.5))' }}
              />
            )}
          </div>

          {/* Away badge — overflows right edge */}
          <div style={{ position: 'absolute', right: -20, top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}>
            {match.away_team.flag_url && (
              <img
                src={match.away_team.flag_url}
                alt=""
                style={{ width: 90, height: 90, objectFit: 'contain', filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.5))' }}
              />
            )}
          </div>

          {/* Main scoreboard — inset from edges to make room for badges */}
          <div style={{ margin: '0 55px', position: 'relative', overflow: 'hidden', minHeight: 160 }}>

            {/* Left panel — home team color, diagonal clip */}
            <div style={{
              position: 'absolute', inset: 0,
              clipPath: 'polygon(0 0, 55% 0, 45% 100%, 0 100%)',
              background: homeColors.accent,
            }}>
              {/* Stadium glow behind badge area */}
              <div style={{ position: 'absolute', left: 30, top: '50%', transform: 'translateY(-50%)', width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%)', pointerEvents: 'none' }} />
            </div>

            {/* Right panel — away team color, diagonal clip */}
            <div style={{
              position: 'absolute', inset: 0,
              clipPath: 'polygon(55% 0, 100% 0, 100% 100%, 45% 100%)',
              background: awayColors.accent,
            }}>
              {/* Stadium glow */}
              <div style={{ position: 'absolute', right: 30, top: '50%', transform: 'translateY(-50%)', width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%)', pointerEvents: 'none' }} />
            </div>

            {/* Content overlay */}
            <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', height: '100%', padding: '20px 0' }}>

              {/* Home: team name + fans + score */}
              <div style={{ flex: 1, paddingLeft: 80, display: 'flex', alignItems: 'center', gap: 20 }}>
                <div>
                  <div style={{ fontFamily: sans, fontSize: '1.4rem', fontWeight: 900, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1 }}>
                    {match.home_team.name}
                  </div>
                  {(state !== 'upcoming') && homeFans.length > 0 && (
                    <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: '2px 8px' }}>
                      {homeFans.map(f => (
                        <span key={f.userId} style={{ fontFamily: sans, fontSize: '0.7rem', color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>
                          {f.displayName}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {/* Home score — inside home panel, pushed to the right */}
                <div style={{ marginLeft: 'auto', paddingRight: 24 }}>
                  <span style={{ fontFamily: sans, fontSize: '5rem', fontWeight: 900, color: '#ffffff', lineHeight: 1, textShadow: '0 2px 12px rgba(0,0,0,0.3)' }}>
                    {state === 'upcoming' ? '?' : currentHome}
                  </span>
                </div>
              </div>

              {/* Center: thin divider line — NO score, NO dash */}
              <div style={{ width: 3, height: 60, background: 'rgba(0,0,0,0.4)', flexShrink: 0 }} />

              {/* Away: score + team name + fans */}
              <div style={{ flex: 1, paddingRight: 80, display: 'flex', alignItems: 'center', gap: 20, justifyContent: 'flex-end' }}>
                {/* Away score — inside away panel, pushed to the left */}
                <div style={{ paddingLeft: 24, marginRight: 'auto' }}>
                  <span style={{ fontFamily: sans, fontSize: '5rem', fontWeight: 900, color: '#ffffff', lineHeight: 1, textShadow: '0 2px 12px rgba(0,0,0,0.3)' }}>
                    {state === 'upcoming' ? '?' : currentAway}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: sans, fontSize: '1.4rem', fontWeight: 900, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1 }}>
                    {match.away_team.name}
                  </div>
                  {(state !== 'upcoming') && awayFans.length > 0 && (
                    <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: '2px 8px', justifyContent: 'flex-end' }}>
                      {awayFans.map(f => (
                        <span key={f.userId} style={{ fontFamily: sans, fontSize: '0.7rem', color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>
                          {f.displayName}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Goal scorers strip */}
            {(state === 'live' || state === 'finished') && goalEvents.length > 0 && (
              <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'center', gap: 32, paddingBottom: 12 }}>
                <div style={{ textAlign: 'right' }}>
                  {allHomeGoals.map(g => (
                    <div key={g.id} style={{ fontFamily: sans, fontSize: '0.65rem', color: 'rgba(255,255,255,0.75)' }}>
                      {g.minute != null ? `'${g.minute}` : ''} {g.player_name ?? '—'}{g.is_own_goal ? ' (og)' : ''}
                    </div>
                  ))}
                </div>
                <div style={{ textAlign: 'left' }}>
                  {allAwayGoals.map(g => (
                    <div key={g.id} style={{ fontFamily: sans, fontSize: '0.65rem', color: 'rgba(255,255,255,0.75)' }}>
                      {g.player_name ?? '—'}{g.is_own_goal ? ' (og)' : ''} {g.minute != null ? `'${g.minute}` : ''}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Distribution bar — dynamic blocks, min-width, disappears when 0% ── */}
        {predictions.length > 0 && (
          <div style={{ display: 'flex', gap: 2, margin: '8px 0' }}>
            {homePct > 0 && (
              <div style={{ flex: homePct, minWidth: 90, background: homeColors.accent, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: sans, fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>{homePct}%</span>
                <span style={{ fontFamily: sans, fontSize: '0.6rem', color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{match.home_team.name} Win</span>
              </div>
            )}
            {drawPct > 0 && (
              <div style={{ flex: drawPct, minWidth: 90, background: '#374151', padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <span style={{ fontFamily: sans, fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>{drawPct}%</span>
                <span style={{ fontFamily: sans, fontSize: '0.6rem', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Draw</span>
              </div>
            )}
            {awayPct > 0 && (
              <div style={{ flex: awayPct, minWidth: 90, background: awayColors.accent, padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                <span style={{ fontFamily: sans, fontSize: '0.6rem', color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{match.away_team.name} Win</span>
                <span style={{ fontFamily: sans, fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>{awayPct}%</span>
              </div>
            )}
          </div>
        )}

        {/* ── Unified prediction list ── */}
        <div style={{ ...blurStyle, ...revealTransition }}>

          {/* Column headers */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderBottom: '1px solid #e0dbd3', background: '#faf9f6' }}>
            <span style={{ flex: 1, fontFamily: sans, fontSize: '0.65rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Looper</span>
            <span style={{ fontFamily: sans, fontSize: '0.65rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Points</span>
          </div>

          {/* All predictions in one list */}
          {allSortedPreds.map(pred => {
            const dotColor = pred.status === 'on_ball' ? '#ff5c35' : pred.status === 'happy' ? '#22c55e' : '#9ca3af'
            const total = pred.matchPoints + pred.squadPoints + pred.teamPoints
            const isMe = pred.userId === currentUserId

            return (
              <div
                key={pred.userId}
                className={risingIds.has(pred.userId) ? 'animate-rise' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 16px',
                  borderBottom: '1px solid #f0ede8',
                  background: isMe ? 'rgba(255,92,53,0.04)' : 'transparent',
                  borderLeft: isMe ? '3px solid #ff5c35' : '3px solid transparent',
                }}
              >
                {/* Status dot */}
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />

                {/* Looper name + prediction */}
                <span style={{ fontFamily: sans, fontSize: '0.85rem', fontWeight: isMe ? 700 : 400, color: isMe ? '#ff5c35' : '#141414', flex: 1 }}>
                  {pred.displayName}
                  <span style={{ fontWeight: 400, color: '#9ca3af', fontSize: '0.75rem', marginLeft: 6 }}>
                    {pred.predictedHome}–{pred.predictedAway}
                  </span>
                </span>

                {/* Player photo if they have a scorer pick in this match */}
                {pred.scorerPickPhoto && (
                  <div style={{ width: 22, height: 22, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '1px solid #e0dbd3' }}>
                    <img src={pred.scorerPickPhoto} alt={pred.scorerPickName ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
                {pred.scorerPickName && !pred.scorerPickPhoto && (
                  <div style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, background: '#e0dbd3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '0.55rem', fontWeight: 700, color: '#6b6b6b', fontFamily: sans }}>{pred.scorerPickName.charAt(0)}</span>
                  </div>
                )}

                {/* Points */}
                <span style={{ fontFamily: sans, fontSize: '0.85rem', fontWeight: 700, color: total > 0 ? '#ff5c35' : '#9ca3af', minWidth: 32, textAlign: 'right' }}>
                  {total > 0 ? `+${total}` : '0'}
                </span>
              </div>
            )
          })}

          {/* Legend */}
          <div style={{ padding: '8px 16px', display: 'flex', gap: 16, borderTop: '1px solid #e0dbd3', background: '#faf9f6' }}>
            {[
              { color: '#ff5c35', label: 'On the ball' },
              { color: '#22c55e', label: 'Happy fans' },
              { color: '#9ca3af', label: 'Remontada?' },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
                <span style={{ fontFamily: sans, fontSize: '0.6rem', color: '#9ca3af' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
