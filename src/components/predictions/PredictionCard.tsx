'use client'

import { useState, useTransition } from 'react'
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

  // Show prediction distribution after lock
  const preMatchReveal = locked && !finished && match.status !== 'scheduled'

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

  const resultBg = finished && prediction?.processed_at
    ? prediction.is_exact
      ? 'border-green-400 bg-green-50'
      : prediction.is_correct_outcome
      ? 'border-yellow-400 bg-yellow-50'
      : 'border-red-200 bg-red-50'
    : 'border-gray-100'

  return (
    <div className={cn('bg-white rounded-2xl border p-4 transition-colors', resultBg)}>
      {/* Match meta */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-400 font-medium">
          {match.venue ? `${match.venue} · ` : ''}{formatKickoff(match.kickoff_at)}
        </span>
        <div className="flex items-center gap-2">
          {finished && prediction?.points_total != null && (
            <span className={cn(
              'text-xs font-bold px-2 py-0.5 rounded-full',
              prediction.is_exact ? 'bg-green-100 text-green-700' :
              prediction.is_correct_outcome ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-600'
            )}>
              +{prediction.points_total} pts
            </span>
          )}
          {locked && <Lock className="w-3.5 h-3.5 text-gray-300" />}
        </div>
      </div>

      {/* Teams + score inputs */}
      <div className="flex items-center gap-2">
        {/* Home team */}
        <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
          <span className="text-sm font-semibold text-gray-800 truncate">{match.home_team?.name ?? '?'}</span>
          {match.home_team?.flag_url && (
            <img src={match.home_team.flag_url} alt="" className="w-6 h-4 object-cover rounded-sm flex-shrink-0" />
          )}
        </div>

        {/* Score inputs or result */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {finished && match.home_score !== null ? (
            <div className="flex items-center gap-1 px-3 py-1 bg-gray-900 text-white rounded-xl font-bold text-sm">
              <span>{match.home_score}</span>
              <span className="text-gray-400">–</span>
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
                className="w-10 text-center py-1.5 rounded-lg border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#ff5c35] disabled:bg-gray-50 disabled:text-gray-400"
              />
              <span className="text-gray-300 font-bold">–</span>
              <input
                type="number"
                min="0"
                max="20"
                value={away}
                onChange={e => { setAway(e.target.value); setSaved(false) }}
                disabled={locked}
                className="w-10 text-center py-1.5 rounded-lg border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#ff5c35] disabled:bg-gray-50 disabled:text-gray-400"
              />
            </>
          )}
        </div>

        {/* Away team */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {match.away_team?.flag_url && (
            <img src={match.away_team.flag_url} alt="" className="w-6 h-4 object-cover rounded-sm flex-shrink-0" />
          )}
          <span className="text-sm font-semibold text-gray-800 truncate">{match.away_team?.name ?? '?'}</span>
        </div>
      </div>

      {/* Your prediction vs actual (if finished) */}
      {finished && prediction && match.home_score !== null && (
        <div className="mt-2 text-center text-xs text-gray-500">
          Your pick: <span className="font-semibold">{prediction.predicted_home}–{prediction.predicted_away}</span>
          {prediction.points_streak_bonus > 0 && (
            <span className="ml-2 text-orange-500 font-semibold">+{prediction.points_streak_bonus} streak 🔥</span>
          )}
        </div>
      )}

      {/* Save button */}
      {!locked && !finished && (
        <div className="mt-3 flex items-center justify-end gap-2">
          {error && <span className="text-xs text-red-500">{error}</span>}
          <button
            onClick={save}
            disabled={saving}
            className={cn(
              'text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1',
              saved
                ? 'bg-green-100 text-green-700'
                : 'bg-[#ff5c35] hover:bg-[#e04a26] text-white'
            )}
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : saved ? <Check className="w-3 h-3" /> : null}
            {saved ? 'Saved!' : 'Save'}
          </button>
        </div>
      )}
    </div>
  )
}
