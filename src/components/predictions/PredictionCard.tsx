'use client'

import { useState } from 'react'
import { formatKickoff, isMatchLocked } from '@/lib/utils'
import { Lock, Check, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { Match, Prediction } from '@/types'

interface Props {
  match: Match
  prediction: Prediction | null
  userId: string
}

export default function PredictionCard({ match, prediction, userId }: Props) {
  const locked = isMatchLocked(match.kickoff_at) || match.status !== 'scheduled'
  const finished = match.status === 'finished'

  const [home, setHome] = useState<string>(prediction?.predicted_home?.toString() ?? '')
  const [away, setAway] = useState<string>(prediction?.predicted_away?.toString() ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (locked) return
    const h = parseInt(home)
    const a = parseInt(away)
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) {
      setError('Please enter valid scores')
      return
    }
    setError('')
    setSaving(true)
    const supabase = createClient()
    const { error: dbError } = await supabase.from('predictions').upsert({
      user_id: userId,
      match_id: match.id,
      predicted_home: h,
      predicted_away: a,
    }, { onConflict: 'user_id,match_id' })
    setSaving(false)
    if (dbError) { setError(dbError.message); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
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
        <span className="text-xs" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
          {match.venue ? `${match.venue} · ` : ''}{formatKickoff(match.kickoff_at)}
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
          {locked && <Lock className="w-3.5 h-3.5" style={{ color: '#e0dbd3' }} />}
        </div>
      </div>

      {/* Teams + score inputs */}
      <div className="flex items-center gap-2">
        {/* Home team */}
        <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
          <span className="text-sm font-semibold truncate" style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}>
            {match.home_team?.name ?? '?'}
          </span>
          {match.home_team?.flag_url && (
            <img src={match.home_team.flag_url} alt="" className="w-6 h-4 object-cover flex-shrink-0" />
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
                max="20"
                value={home}
                onChange={e => { setHome(e.target.value); setSaved(false) }}
                disabled={locked}
                className="w-10 text-center py-1.5 text-sm font-bold focus:outline-none"
                style={{
                  border: '1px solid #e0dbd3',
                  fontFamily: 'Inter, sans-serif',
                  background: locked ? '#faf9f6' : '#ffffff',
                  color: locked ? '#6b6b6b' : '#141414'
                }}
              />
              <span className="font-bold" style={{ color: '#e0dbd3', fontFamily: 'Inter, sans-serif' }}>–</span>
              <input
                type="number"
                min="0"
                max="20"
                value={away}
                onChange={e => { setAway(e.target.value); setSaved(false) }}
                disabled={locked}
                className="w-10 text-center py-1.5 text-sm font-bold focus:outline-none"
                style={{
                  border: '1px solid #e0dbd3',
                  fontFamily: 'Inter, sans-serif',
                  background: locked ? '#faf9f6' : '#ffffff',
                  color: locked ? '#6b6b6b' : '#141414'
                }}
              />
            </>
          )}
        </div>

        {/* Away team */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {match.away_team?.flag_url && (
            <img src={match.away_team.flag_url} alt="" className="w-6 h-4 object-cover flex-shrink-0" />
          )}
          <span className="text-sm font-semibold truncate" style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}>
            {match.away_team?.name ?? '?'}
          </span>
        </div>
      </div>

      {/* Your prediction vs actual (if finished) */}
      {finished && prediction && match.home_score !== null && (
        <div className="mt-2 text-center text-xs" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
          Your pick: <span className="font-semibold">{prediction.predicted_home}–{prediction.predicted_away}</span>
          {prediction.points_streak_bonus > 0 && (
            <span className="ml-2 font-semibold" style={{ color: '#ff5c35' }}>+{prediction.points_streak_bonus} streak 🔥</span>
          )}
        </div>
      )}

      {/* Save button */}
      {!locked && !finished && (
        <div className="mt-3 flex items-center justify-end gap-2">
          {error && <span className="text-xs" style={{ color: '#dc2626', fontFamily: 'Inter, sans-serif' }}>{error}</span>}
          <button
            onClick={save}
            disabled={saving}
            className="text-xs font-semibold px-3 py-1.5 transition-colors flex items-center gap-1"
            style={{
              fontFamily: 'Inter, sans-serif',
              background: saved ? '#dcfce7' : '#ff5c35',
              color: saved ? '#15803d' : '#ffffff'
            }}
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : saved ? <Check className="w-3 h-3" /> : null}
            {saved ? 'Saved!' : 'Save'}
          </button>
        </div>
      )}
    </div>
  )
}
