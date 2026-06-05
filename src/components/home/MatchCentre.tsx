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

const TEAM_COLORS: Record<string, { bg: string; accent: string; dark: string }> = {
  'Mexico':             { bg: 'rgba(0,104,71,0.08)',    accent: '#006847', dark: '#003D29' },
  'South Africa':       { bg: 'rgba(0,122,77,0.08)',    accent: '#007A4D', dark: '#004D30' },
  'South Korea':        { bg: 'rgba(206,17,38,0.08)',   accent: '#CE1126', dark: '#8A0B19' },
  'Czech Republic':     { bg: 'rgba(215,20,26,0.08)',   accent: '#D7141A', dark: '#8B0D11' },
  'Canada':             { bg: 'rgba(255,0,0,0.08)',     accent: '#FF0000', dark: '#990000' },
  'Bosnia and Herzegovina': { bg: 'rgba(0,47,108,0.08)', accent: '#002F6C', dark: '#001840' },
  'Qatar':              { bg: 'rgba(141,27,61,0.08)',   accent: '#8D1B3D', dark: '#5A1127' },
  'Switzerland':        { bg: 'rgba(255,0,0,0.08)',     accent: '#FF0000', dark: '#990000' },
  'Brazil':             { bg: 'rgba(252,223,0,0.1)',    accent: '#FCDF00', dark: '#8A7A00' },
  'Morocco':            { bg: 'rgba(0,98,51,0.08)',     accent: '#006233', dark: '#003D20' },
  'Haiti':              { bg: 'rgba(0,32,159,0.08)',    accent: '#00209F', dark: '#001266' },
  'Scotland':           { bg: 'rgba(0,94,184,0.08)',    accent: '#005EB8', dark: '#003D7A' },
  'United States':      { bg: 'rgba(0,40,104,0.08)',   accent: '#002868', dark: '#001540' },
  'Australia':          { bg: 'rgba(255,205,0,0.1)',    accent: '#FFCD00', dark: '#8A7000' },
  'Paraguay':           { bg: 'rgba(213,43,30,0.08)',   accent: '#D52B1E', dark: '#8A1C14' },
  'Turkey':             { bg: 'rgba(227,10,23,0.08)',   accent: '#E30A17', dark: '#99070F' },
  'Germany':            { bg: 'rgba(30,30,30,0.07)',    accent: '#1a1a1a', dark: '#000000' },
  'Curaçao':            { bg: 'rgba(0,61,165,0.08)',    accent: '#003DA5', dark: '#00266B' },
  "Côte d'Ivoire":      { bg: 'rgba(247,127,0,0.08)',   accent: '#F77F00', dark: '#A55500' },
  'Ecuador':            { bg: 'rgba(255,209,0,0.1)',    accent: '#FFD100', dark: '#8A7000' },
  'Netherlands':        { bg: 'rgba(255,99,0,0.08)',    accent: '#FF6300', dark: '#B34400' },
  'Japan':              { bg: 'rgba(0,61,165,0.08)',    accent: '#003DA5', dark: '#00266B' },
  'Sweden':             { bg: 'rgba(253,220,68,0.1)',   accent: '#FDDC44', dark: '#8A7820' },
  'Tunisia':            { bg: 'rgba(231,0,0,0.08)',     accent: '#E70000', dark: '#990000' },
  'Belgium':            { bg: 'rgba(239,51,64,0.08)',   accent: '#EF3340', dark: '#A01E28' },
  'Egypt':              { bg: 'rgba(206,17,0,0.08)',    accent: '#CE1100', dark: '#880B00' },
  'Iran':               { bg: 'rgba(35,159,64,0.08)',   accent: '#239F40', dark: '#16662A' },
  'New Zealand':        { bg: 'rgba(0,36,125,0.08)',    accent: '#00247D', dark: '#001550' },
  'Spain':              { bg: 'rgba(170,21,27,0.08)',   accent: '#AA151B', dark: '#6E0E12' },
  'Cape Verde':         { bg: 'rgba(0,49,131,0.08)',    accent: '#003183', dark: '#001F54' },
  'Uruguay':            { bg: 'rgba(91,164,207,0.1)',   accent: '#5BA4CF', dark: '#2E6E9E' },
  'Saudi Arabia':       { bg: 'rgba(0,98,51,0.08)',     accent: '#006233', dark: '#003D20' },
  'France':             { bg: 'rgba(0,35,149,0.08)',    accent: '#002395', dark: '#001466' },
  'Senegal':            { bg: 'rgba(0,133,63,0.08)',    accent: '#00853F', dark: '#005529' },
  'Iraq':               { bg: 'rgba(0,122,61,0.08)',    accent: '#007A3D', dark: '#004D26' },
  'Norway':             { bg: 'rgba(239,43,45,0.08)',   accent: '#EF2B2D', dark: '#9F1D1E' },
  'Argentina':          { bg: 'rgba(116,172,223,0.1)',  accent: '#74ACDF', dark: '#2E6E9E' },
  'Algeria':            { bg: 'rgba(0,98,51,0.08)',     accent: '#006233', dark: '#003D20' },
  'Austria':            { bg: 'rgba(237,40,0,0.08)',    accent: '#ED2800', dark: '#9E1B00' },
  'Jordan':             { bg: 'rgba(0,122,61,0.08)',    accent: '#007A3D', dark: '#004D26' },
  'Portugal':           { bg: 'rgba(206,17,38,0.08)',   accent: '#CE1126', dark: '#880B19' },
  'Congo DR':           { bg: 'rgba(0,127,255,0.08)',   accent: '#007FFF', dark: '#0055AA' },
  'Uzbekistan':         { bg: 'rgba(30,181,58,0.08)',   accent: '#1EB53A', dark: '#127826' },
  'Colombia':           { bg: 'rgba(252,209,22,0.1)',   accent: '#FCD116', dark: '#8A7010' },
  'England':            { bg: 'rgba(1,33,105,0.08)',    accent: '#012169', dark: '#000E40' },
  'Croatia':            { bg: 'rgba(23,23,150,0.08)',   accent: '#171796', dark: '#0E0E62' },
  'Ghana':              { bg: 'rgba(252,209,22,0.08)',  accent: '#FCD116', dark: '#8A7010' },
  'Panama':             { bg: 'rgba(213,20,26,0.08)',   accent: '#D52B1E', dark: '#8D0D11' },
}

function getTeamColors(name: string | null | undefined): { bg: string; accent: string; dark: string } {
  if (!name) return { bg: 'rgba(100,100,100,0.06)', accent: '#6b6b6b', dark: '#3a3a3a' }
  return TEAM_COLORS[name] ?? { bg: 'rgba(100,100,100,0.06)', accent: '#6b6b6b', dark: '#3a3a3a' }
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
  const [hoveredPhoto, setHoveredPhoto] = useState<string | null>(null)

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
        setTimeout(() => setRisingIds(new Set()), 2100)
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
      {/* Keyframe for rise animation + mobile styles */}
      <style>{`
        @media (max-width: 639px) {
          .mc-outer   { margin: 0 !important; }
          .mc-badge   { display: none !important; }
          .mc-score   { font-size: 3.5rem !important; }
          .mc-name    { font-size: 1rem !important; }
          .mc-scoreboard { min-height: 140px !important; }
        }
        @keyframes rise {
          /* Start: row appears at roughly its old (lower) position */
          0%   { transform: translateY(48px)  scale(0.98);  box-shadow: none;                           z-index: 1;  }
          /* Phase 1: shoot up past new position — visually hovers above the overtaken rows */
          22%  { transform: translateY(-34px) scale(1.03);  box-shadow: 0 10px 32px rgba(0,0,0,0.16);  z-index: 10; }
          /* Phase 2: hold the hover — floating above */
          58%  { transform: translateY(-34px) scale(1.025); box-shadow: 0 8px 24px rgba(0,0,0,0.12);   z-index: 10; }
          /* Phase 3: start drop, slight overshoot below */
          82%  { transform: translateY(6px)   scale(1.005); box-shadow: 0 3px 10px rgba(0,0,0,0.06);   z-index: 10; }
          /* Phase 4: settle into new position */
          100% { transform: translateY(0)     scale(1);      box-shadow: none;                           z-index: 1;  }
        }
        .animate-rise {
          animation: rise 2s cubic-bezier(0.22, 0.61, 0.36, 1);
          position: relative;
          z-index: 10;
        }
      `}</style>

      {/* Outer wrapper — narrows the widget so badges can overflow the edges */}
      <div className="mc-outer" style={{ margin: '0 84px' }}>
      <section
        style={{
          background: '#ffffff',
          border: '1px solid #e0dbd3',
          overflow: 'visible',
          position: 'relative',
        }}
      >
        {/* ── Header bar ── */}
        <div
          style={{
            background: '#141414',
            padding: '14px 24px',
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

        {/* ── Scoreboard wrapper — badges centered on left/right edges of the section ── */}
        <div style={{ position: 'relative' }}>

          {/* Home badge — centre sits exactly on the left edge of the section */}
          {match.home_team.flag_url && (
            <div className="mc-badge" style={{ position: 'absolute', left: -80, top: '50%', transform: 'translateY(-50%)', zIndex: 20, width: 160, height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src={match.home_team.flag_url} alt="" style={{ width: 155, height: 155, objectFit: 'contain', filter: 'drop-shadow(0 4px 24px rgba(0,0,0,0.3))' }} />
            </div>
          )}

          {/* Away badge — centre sits exactly on the right edge of the section */}
          {match.away_team.flag_url && (
            <div className="mc-badge" style={{ position: 'absolute', right: -80, top: '50%', transform: 'translateY(-50%)', zIndex: 20, width: 160, height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src={match.away_team.flag_url} alt="" style={{ width: 155, height: 155, objectFit: 'contain', filter: 'drop-shadow(0 4px 24px rgba(0,0,0,0.3))' }} />
            </div>
          )}

          {/* Scoreboard — clip-path handles diagonal panels, no overflow:hidden needed */}
          <div className="mc-scoreboard" style={{ position: 'relative', minHeight: 200 }}>

            {/* Left panel — home team color, diagonal clip */}
            <div style={{
              position: 'absolute', inset: 0,
              clipPath: 'polygon(0 0, 55% 0, 45% 100%, 0 100%)',
              background: `linear-gradient(to right, ${homeColors.dark} 0%, ${homeColors.accent} 55%)`,
            }} />

            {/* Right panel — away team color, diagonal clip */}
            <div style={{
              position: 'absolute', inset: 0,
              clipPath: 'polygon(55% 0, 100% 0, 100% 100%, 45% 100%)',
              background: `linear-gradient(to left, ${awayColors.dark} 0%, ${awayColors.accent} 55%)`,
            }} />

            {/* Content — badge / team name / score all on same horizontal line */}
            <div className="mc-scoreboard" style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', minHeight: 200, padding: '24px 0' }}>

              {/* Home side: name + fans left, score right — both centered vertically */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', paddingLeft: 16, paddingRight: 8 }}>
                {/* Team name — centered between badge edge and score */}
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div className="mc-name" style={{ fontFamily: sans, fontSize: '1.5rem', fontWeight: 900, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1, textShadow: '0 2px 16px rgba(0,0,0,0.5)' }}>
                    {match.home_team.name}
                  </div>
                </div>
                {/* Score — right-aligned in home panel */}
                <span className="mc-score" style={{ fontFamily: sans, fontSize: '5.5rem', fontWeight: 900, color: '#ffffff', lineHeight: 1, textShadow: '0 2px 16px rgba(0,0,0,0.35)', paddingRight: 12, flexShrink: 0 }}>
                  {state === 'upcoming' ? '?' : currentHome}
                </span>
              </div>

              {/* Divider */}
              <div style={{ width: 4, alignSelf: 'stretch', background: 'rgba(0,0,0,0.35)', flexShrink: 0 }} />

              {/* Away side: score left, name centered */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', paddingRight: 16, paddingLeft: 8 }}>
                {/* Score — left-aligned in away panel */}
                <span className="mc-score" style={{ fontFamily: sans, fontSize: '5.5rem', fontWeight: 900, color: '#ffffff', lineHeight: 1, textShadow: '0 2px 16px rgba(0,0,0,0.35)', paddingLeft: 12, flexShrink: 0 }}>
                  {state === 'upcoming' ? '?' : currentAway}
                </span>
                {/* Team name — centered between score and badge edge */}
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div className="mc-name" style={{ fontFamily: sans, fontSize: '1.5rem', fontWeight: 900, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1, textShadow: '0 2px 16px rgba(0,0,0,0.5)' }}>
                    {match.away_team.name}
                  </div>
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

        {/* ── Fan strip — between scoreboard and prediction bar ── */}
        {(homeFans.length > 0 || awayFans.length > 0) && (
          <div style={{
            background: `linear-gradient(to right, ${homeColors.dark} 0%, ${homeColors.accent} 40%, ${awayColors.accent} 60%, ${awayColors.dark} 100%)`,
            padding: '8px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}>
            <div style={{ fontFamily: sans, fontSize: '0.72rem', color: 'rgba(255,255,255,0.85)', fontWeight: 500, letterSpacing: '0.01em' }}>
              {homeFans.map(f => f.displayName).join(' / ')}
            </div>
            <div style={{ fontFamily: sans, fontSize: '0.72rem', color: 'rgba(255,255,255,0.85)', fontWeight: 500, textAlign: 'right', letterSpacing: '0.01em' }}>
              {awayFans.map(f => f.displayName).join(' / ')}
            </div>
          </div>
        )}

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

                {/* Scorer pick photo with hover tooltip */}
                {(pred.scorerPickPhoto || pred.scorerPickName) && (() => {
                  const key = `${pred.userId}_scorer`
                  return (
                    <div
                      style={{ position: 'relative', flexShrink: 0 }}
                      onMouseEnter={() => setHoveredPhoto(key)}
                      onMouseLeave={() => setHoveredPhoto(null)}
                    >
                      <div style={{ width: 22, height: 22, borderRadius: '50%', overflow: 'hidden', border: '1px solid #e0dbd3', background: '#e0dbd3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {pred.scorerPickPhoto
                          ? <img src={pred.scorerPickPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <span style={{ fontSize: '0.55rem', fontWeight: 700, color: '#6b6b6b', fontFamily: sans }}>{pred.scorerPickName!.charAt(0)}</span>
                        }
                      </div>
                      {hoveredPhoto === key && pred.scorerPickName && (
                        <div style={{ position: 'absolute', bottom: 'calc(100% + 4px)', left: '50%', transform: 'translateX(-50%)', background: '#141414', color: '#ffffff', padding: '2px 6px', fontSize: '0.6rem', fontFamily: sans, whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 50 }}>
                          {pred.scorerPickName}
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* 12th man player photo (gold ring) with hover tooltip */}
                {pred.favPlayerIsInMatch && (() => {
                  const key = `${pred.userId}_fav`
                  return (
                    <div
                      style={{ position: 'relative', flexShrink: 0 }}
                      onMouseEnter={() => setHoveredPhoto(key)}
                      onMouseLeave={() => setHoveredPhoto(null)}
                    >
                      <div style={{ width: 22, height: 22, borderRadius: '50%', overflow: 'hidden', border: '2px solid #FFD700', background: '#e0dbd3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {pred.favPlayerPhoto
                          ? <img src={pred.favPlayerPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <span style={{ fontSize: '0.55rem', fontWeight: 700, color: '#6b6b6b', fontFamily: sans }}>⭐</span>
                        }
                      </div>
                      {hoveredPhoto === key && (
                        <div style={{ position: 'absolute', bottom: 'calc(100% + 4px)', left: '50%', transform: 'translateX(-50%)', background: '#FFD700', color: '#141414', padding: '2px 6px', fontSize: '0.6rem', fontFamily: sans, fontWeight: 700, whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 50 }}>
                          {pred.favPlayerName ?? '12th Man'} ⭐
                        </div>
                      )}
                    </div>
                  )
                })()}

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
      </div> {/* end outer margin wrapper */}
    </>
  )
}
