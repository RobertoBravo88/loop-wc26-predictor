'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { formatKickoff, isMatchLocked, getNow } from '@/lib/utils'
import { Lock, Check, Loader2, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import TeamFanBadge from '@/components/ui/TeamFanBadge'
import type { Match, Prediction } from '@/types'

interface Props {
  match: Match
  prediction: Prediction | null
  userId: string
  distribution?: { home: number; draw: number; away: number; total: number }
  showLockCountdown?: boolean
  fanCountMap?: Record<string, number>
}

function getLockCountdownText(kickoffAt: string): string | null {
  const now = getNow()
  const kickoff = new Date(kickoffAt)
  const diffMs = kickoff.getTime() - now.getTime()
  if (diffMs <= 0) return null
  const diffHours = diffMs / (1000 * 60 * 60)
  if (diffHours <= 48) {
    const hours = Math.floor(diffHours)
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    return `Locks in ${hours}h ${minutes}m`
  }
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  if (diffDays <= 7) {
    return `Locks in ${Math.floor(diffDays)} days`
  }
  return null
}

export default function PredictionCard({ match, prediction, userId, distribution, showLockCountdown, fanCountMap }: Props) {
  const router = useRouter()
  const locked = isMatchLocked(match.kickoff_at) || match.status !== 'scheduled'
  const finished = match.status === 'finished'

  const [home, setHome] = useState<string>(prediction?.predicted_home?.toString() ?? '')
  const [away, setAway] = useState<string>(prediction?.predicted_away?.toString() ?? '')
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)
  const [saveError, setSaveError] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function triggerAutoSave(h: string, a: string) {
    if (locked) return
    if (debounceRef.current) clearTimeout(debounceRef.current)

    // Both cleared → delete the prediction
    if (h === '' && a === '') {
      debounceRef.current = setTimeout(async () => {
        setSaving(true); setSaveError(false)
        const supabase = createClient()
        const { error } = await supabase.from('predictions')
          .delete()
          .eq('user_id', userId)
          .eq('match_id', match.id)
        setSaving(false)
        if (error) { setSaveError(true); setTimeout(() => setSaveError(false), 4000) }
        else        { setSaved(true); router.refresh(); setTimeout(() => setSaved(false), 2000) }
      }, 600)
      return
    }

    const hNum = parseInt(h)
    const aNum = parseInt(a)
    if (isNaN(hNum) || isNaN(aNum) || hNum < 0 || aNum < 0 || hNum > 99 || aNum > 99) return

    debounceRef.current = setTimeout(async () => {
      setSaving(true)
      setSaveError(false)
      const supabase = createClient()
      const { error } = await supabase.from('predictions').upsert({
        user_id: userId,
        match_id: match.id,
        predicted_home: hNum,
        predicted_away: aNum,
      }, { onConflict: 'user_id,match_id' })
      setSaving(false)
      if (error) {
        setSaveError(true)
        setTimeout(() => setSaveError(false), 4000)
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    }, 600)
  }

  // Result border/background based on outcome
  let rowBg = '#ffffff'
  let rowBorder = '1px solid #e0dbd3'
  let accentLeft = '3px solid transparent'
  if (finished && prediction?.processed_at) {
    if (prediction.is_exact) {
      rowBg = '#f0fdf4'
      accentLeft = '3px solid #22c55e'
    } else if (prediction.is_correct_outcome) {
      rowBg = '#fefce8'
      accentLeft = '3px solid #eab308'
    } else {
      rowBg = '#fff5f5'
      accentLeft = '3px solid #f87171'
    }
  }

  return (
    <div
      className="px-5 py-4 transition-colors"
      style={{
        background: rowBg,
        borderBottom: rowBorder,
        borderLeft: accentLeft
      }}
    >
      {/* Match meta */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs flex items-center gap-2" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
          {match.venue ? `${match.venue} · ` : ''}{formatKickoff(match.kickoff_at)}
          {showLockCountdown && !locked && !finished && (() => {
            const text = getLockCountdownText(match.kickoff_at)
            if (!text) return null
            const hasPrediction = prediction !== null
            return hasPrediction ? (
              // Lighter style — pick made, just a reminder
              <span
                className="text-xs font-semibold px-1.5 py-0.5"
                style={{ background: 'transparent', color: '#ff5c35', border: '1px solid #ff5c35', fontFamily: 'Inter, sans-serif', fontSize: '0.65rem', letterSpacing: '0.01em' }}
              >
                {text}
              </span>
            ) : (
              // Solid style — no pick yet, urgent
              <span
                className="text-xs font-semibold px-1.5 py-0.5"
                style={{ background: '#ff5c35', color: '#ffffff', fontFamily: 'Inter, sans-serif', fontSize: '0.65rem', letterSpacing: '0.01em' }}
              >
                {text}
              </span>
            )
          })()}
        </span>
        <div className="flex items-center gap-2">
          {finished && prediction?.points_total != null && (
            <span
              className="text-xs font-bold px-2 py-0.5"
              style={{
                fontFamily: 'Inter, sans-serif',
                background: prediction.is_exact ? '#dcfce7' : prediction.is_correct_outcome ? '#fef9c3' : '#fee2e2',
                color: prediction.is_exact ? '#15803d' : prediction.is_correct_outcome ? '#a16207' : '#dc2626'
              }}
            >
              +{prediction.points_total} pts
            </span>
          )}
          {/* Auto-save indicator */}
          {!locked && !finished && (
            saving ? (
              <span className="flex items-center gap-1 text-xs" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
                <Loader2 className="w-3 h-3 animate-spin" />
                Saving…
              </span>
            ) : saveError ? (
              <span className="flex items-center gap-1 text-xs" style={{ color: '#dc2626', fontFamily: 'Inter, sans-serif' }}>
                <AlertCircle className="w-3 h-3" />
                Save failed — try again
              </span>
            ) : saved ? (
              <span className="flex items-center gap-1 text-xs" style={{ color: '#15803d', fontFamily: 'Inter, sans-serif' }}>
                <Check className="w-3 h-3" />
                Saved
              </span>
            ) : null
          )}
          {locked && <Lock className="w-3.5 h-3.5" style={{ color: '#e0dbd3' }} />}
        </div>
      </div>

      {/* Teams + score inputs */}
      <div className="flex items-center gap-2">
        {/* Home team */}
        <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
          {match.home_team && <TeamFanBadge teamId={match.home_team.id} count={fanCountMap?.[match.home_team.id] ?? 0} />}
          <span className="text-sm font-semibold truncate" style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}>
            {match.home_team?.name ?? '?'}
          </span>
          {match.home_team?.flag_url && (
            <img src={match.home_team.flag_url} alt="" className="w-6 h-4 object-contain flex-shrink-0" />
          )}
        </div>

        {/* Score inputs or result */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {finished && match.home_score !== null ? (
            <div
              className="flex items-center gap-1 px-3 py-1 font-bold text-sm text-white"
              style={{ background: '#141414', fontFamily: 'Inter, sans-serif' }}
            >
              <span>{match.home_score}</span>
              <span style={{ color: '#6b6b6b' }}>–</span>
              <span>{match.away_score}</span>
            </div>
          ) : (
            <>
              <input
                type="number"
                min="0"
                max="99"
                value={home}
                onChange={e => { const v = e.target.value; setHome(v); setSaved(false); triggerAutoSave(v, away) }}
                disabled={locked}
                className="w-10 py-1.5 text-sm font-bold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                style={{
                  border: '1px solid #e0dbd3',
                  fontFamily: 'Inter, sans-serif',
                  background: locked ? '#faf9f6' : '#ffffff',
                  color: locked ? '#6b6b6b' : '#141414',
                  textAlign: 'center',
                  lineHeight: '1',
                  appearance: 'textfield',
                }}
              />
              <span className="font-bold" style={{ color: '#e0dbd3', fontFamily: 'Inter, sans-serif' }}>–</span>
              <input
                type="number"
                min="0"
                max="99"
                value={away}
                onChange={e => { const v = e.target.value; setAway(v); setSaved(false); triggerAutoSave(home, v) }}
                disabled={locked}
                className="w-10 py-1.5 text-sm font-bold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                style={{
                  border: '1px solid #e0dbd3',
                  fontFamily: 'Inter, sans-serif',
                  background: locked ? '#faf9f6' : '#ffffff',
                  color: locked ? '#6b6b6b' : '#141414',
                  textAlign: 'center',
                  lineHeight: '1',
                  appearance: 'textfield',
                }}
              />
            </>
          )}
        </div>

        {/* Away team */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {match.away_team?.flag_url && (
            <img src={match.away_team.flag_url} alt="" className="w-6 h-4 object-contain flex-shrink-0" />
          )}
          <span className="text-sm font-semibold truncate" style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}>
            {match.away_team?.name ?? '?'}
          </span>
          {match.away_team && <TeamFanBadge teamId={match.away_team.id} count={fanCountMap?.[match.away_team.id] ?? 0} />}
        </div>
      </div>

      {/* Prediction distribution — shown once user has submitted their own pick */}
      {distribution && distribution.total > 0 && prediction && (
        <div className="mt-3 pt-2" style={{ borderTop: '1px solid #f0ede8' }}>
          {/* Bar */}
          <div className="flex h-1.5 w-full overflow-hidden mb-1.5" style={{ background: '#f0ede8' }}>
            <div style={{ width: `${Math.round(distribution.home / distribution.total * 100)}%`, background: '#141414' }} />
            <div style={{ width: `${Math.round(distribution.draw / distribution.total * 100)}%`, background: '#d4cfc8' }} />
            <div style={{ width: `${Math.round(distribution.away / distribution.total * 100)}%`, background: '#ff5c35' }} />
          </div>
          {/* Labels */}
          <div className="flex justify-between text-xs" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
            <span><span className="font-semibold" style={{ color: '#141414' }}>{Math.round(distribution.home / distribution.total * 100)}%</span> {match.home_team?.name}</span>
            <span><span className="font-semibold" style={{ color: '#6b6b6b' }}>{Math.round(distribution.draw / distribution.total * 100)}%</span> Draw</span>
            <span>{match.away_team?.name} <span className="font-semibold" style={{ color: '#ff5c35' }}>{Math.round(distribution.away / distribution.total * 100)}%</span></span>
          </div>
        </div>
      )}

      {/* Your prediction vs actual (if finished) */}
      {finished && prediction && match.home_score !== null && (
        <div className="mt-2 text-center text-xs" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
          Your call: <span className="font-semibold">{prediction.predicted_home}–{prediction.predicted_away}</span>
          {prediction.points_streak_bonus > 0 && (
            <span className="ml-2 font-semibold" style={{ color: '#ff5c35' }}>+{prediction.points_streak_bonus} streak 🔥</span>
          )}
        </div>
      )}
    </div>
  )
}
