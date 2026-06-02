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
}

const serif = "'Playfair Display', Georgia, serif"
const sans = 'Inter, sans-serif'

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

function statusLabel(s: PredStatus): string {
  if (s === 'on_ball') return 'On the Ball'
  if (s === 'happy') return 'Happy Fans'
  if (s === 'still_in') return 'Still in it'
  return 'Out'
}

function statusEmoji(s: PredStatus): string {
  if (s === 'on_ball') return '🎯'
  if (s === 'happy') return '😊'
  if (s === 'still_in') return '⏳'
  return '💔'
}

function statusAccent(s: PredStatus): string {
  if (s === 'on_ball') return '#ff5c35'
  if (s === 'happy') return '#16a34a'
  return '#9ca3af'
}

// ============================================================
// Component
// ============================================================

export default function MatchCentre({ data }: MatchCentreProps) {
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

  const sections: PredStatus[] = ['on_ball', 'happy', 'still_in']

  const blurStyle = revealed ? { filter: 'blur(0)' } : { filter: 'blur(6px)', userSelect: 'none' as const, pointerEvents: 'none' as const }
  const revealTransition = { transition: 'filter 0.8s ease-out' }

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

        {/* Scoreboard */}
        <div
          style={{
            padding: '16px 16px 12px',
            borderBottom: '1px solid #e0dbd3',
            background: '#faf9f6',
          }}
        >
          {match.group_letter && (
            <p
              style={{
                fontFamily: sans,
                fontSize: '0.65rem',
                color: '#6b6b6b',
                textAlign: 'center',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: 8,
              }}
            >
              Group {match.group_letter}{match.venue ? ` · ${match.venue}` : ''}
            </p>
          )}

          {/* Teams + score */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            {/* Home team */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 90, textAlign: 'center' }}>
              {match.home_team.flag_url && (
                <img src={match.home_team.flag_url} alt="" style={{ width: 36, height: 24, objectFit: 'contain' }} />
              )}
              <span style={{ fontFamily: sans, fontSize: '0.85rem', fontWeight: 700, color: '#141414' }}>
                {match.home_team.name}
              </span>
            </div>

            {/* Score */}
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontFamily: serif,
                  fontSize: '2rem',
                  fontWeight: 900,
                  color: '#141414',
                  lineHeight: 1,
                  minWidth: 80,
                }}
              >
                {state === 'upcoming'
                  ? <span style={{ color: '#9ca3af', fontSize: '1.2rem' }}>vs</span>
                  : state === 'preview'
                  ? '? – ?'
                  : `${currentHome} – ${currentAway}`}
              </div>
              {state === 'upcoming' && (
                <div style={{ fontFamily: sans, fontSize: '0.7rem', color: '#6b6b6b', marginTop: 4 }}>
                  {new Date(match.kickoff_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </div>

            {/* Away team */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 90, textAlign: 'center' }}>
              {match.away_team.flag_url && (
                <img src={match.away_team.flag_url} alt="" style={{ width: 36, height: 24, objectFit: 'contain' }} />
              )}
              <span style={{ fontFamily: sans, fontSize: '0.85rem', fontWeight: 700, color: '#141414' }}>
                {match.away_team.name}
              </span>
            </div>
          </div>

          {/* Goal scorers — shown when state is live or finished */}
          {(state === 'live' || state === 'finished') && goalEvents.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginTop: 8 }}>
              <div style={{ minWidth: 120, textAlign: 'right' }}>
                {allHomeGoals.map(g => (
                  <span key={g.id} style={{ display: 'block', fontFamily: sans, fontSize: '0.7rem', color: '#6b6b6b' }}>
                    {g.minute != null ? `'${g.minute}` : ''} {g.player_name ?? '—'}{g.is_own_goal ? ' (og)' : ''}
                  </span>
                ))}
              </div>
              <div style={{ minWidth: 20 }} />
              <div style={{ minWidth: 120, textAlign: 'left' }}>
                {allAwayGoals.map(g => (
                  <span key={g.id} style={{ display: 'block', fontFamily: sans, fontSize: '0.7rem', color: '#6b6b6b' }}>
                    {g.player_name ?? '—'}{g.is_own_goal ? ' (og)' : ''} {g.minute != null ? `'${g.minute}` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Blurred section: fans + predictions */}
        <div style={{ ...blurStyle, ...revealTransition }}>
          {/* Fan bases */}
          {(homeFans.length > 0 || awayFans.length > 0) && (
            <div
              style={{
                padding: '10px 16px',
                borderBottom: '1px solid #e0dbd3',
                display: 'flex',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              {homeFans.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {match.home_team.flag_url && (
                    <img src={match.home_team.flag_url} alt="" style={{ width: 18, height: 12, objectFit: 'contain', flexShrink: 0 }} />
                  )}
                  <span style={{ fontFamily: sans, fontSize: '0.75rem', color: '#141414', fontWeight: 600 }}>Fans:</span>
                  <span style={{ fontFamily: sans, fontSize: '0.75rem', color: '#6b6b6b' }}>
                    {homeFans.map(f => f.displayName).join(' · ')}
                  </span>
                </div>
              )}
              {awayFans.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {match.away_team.flag_url && (
                    <img src={match.away_team.flag_url} alt="" style={{ width: 18, height: 12, objectFit: 'contain', flexShrink: 0 }} />
                  )}
                  <span style={{ fontFamily: sans, fontSize: '0.75rem', color: '#141414', fontWeight: 600 }}>Fans:</span>
                  <span style={{ fontFamily: sans, fontSize: '0.75rem', color: '#6b6b6b' }}>
                    {awayFans.map(f => f.displayName).join(' · ')}
                  </span>
                </div>
              )}
            </div>
          )}

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
                <span style={{ fontFamily: sans, fontSize: '0.65rem', color: '#6b6b6b', textAlign: 'center' }}>🎯</span>
                <span style={{ fontFamily: sans, fontSize: '0.65rem', color: '#6b6b6b', textAlign: 'center' }}>👟</span>
                <span style={{ fontFamily: sans, fontSize: '0.65rem', color: '#6b6b6b', textAlign: 'center' }}>⭐</span>
                <span style={{ fontFamily: sans, fontSize: '0.65rem', color: '#6b6b6b', textAlign: 'center', fontWeight: 700 }}>Pts</span>
              </div>

              {sections.map(sectionStatus => {
                const sectionPreds = sortedPreds.filter(p => p.status === sectionStatus)
                if (sectionPreds.length === 0) return null
                return (
                  <div key={sectionStatus}>
                    {/* Section header */}
                    <div
                      style={{
                        padding: '4px 16px',
                        background: '#faf9f6',
                        borderBottom: '1px solid #e0dbd3',
                        borderLeft: `3px solid ${statusAccent(sectionStatus)}`,
                      }}
                    >
                      <span style={{ fontFamily: sans, fontSize: '0.65rem', fontWeight: 700, color: statusAccent(sectionStatus), textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {statusEmoji(sectionStatus)} {statusLabel(sectionStatus)}
                      </span>
                    </div>

                    {/* Rows */}
                    {sectionPreds.map(pred => {
                      const total = pred.matchPoints + pred.squadPoints + pred.teamPoints
                      const isRising = risingIds.has(pred.userId)
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
                          }}
                        >
                          <span style={{ fontFamily: sans, fontSize: '0.8rem', color: '#141414' }}>
                            {pred.displayName}
                            <span style={{ color: '#9ca3af', marginLeft: 6 }}>
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
                            {total}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}

          {/* Out ticker */}
          {outPreds.length > 0 && (
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
                💔 Out of the match ·
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
