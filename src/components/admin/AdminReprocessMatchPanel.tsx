'use client'

import { useState, useEffect } from 'react'
import { Loader2, Check, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface FinishedMatch {
  id: string
  match_number: number | null
  kickoff_at: string
  home_score: number | null
  away_score: number | null
  home_team: { name: string } | null
  away_team: { name: string } | null
}

export default function AdminReprocessMatchPanel() {
  const [matches, setMatches] = useState<FinishedMatch[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('matches')
      .select('id, match_number, kickoff_at, home_score, away_score, home_team:teams!home_team_id(name), away_team:teams!away_team_id(name)')
      .eq('status', 'finished')
      .order('kickoff_at', { ascending: false })
      .then(({ data }) => {
        if (data) setMatches(data as unknown as FinishedMatch[])
      })
  }, [])

  async function handleFix() {
    if (!selectedId) return
    setState('loading')
    setMessage('')
    try {
      const res = await fetch(`/api/admin/reprocess-predictions?matchId=${selectedId}`, { method: 'POST' })
      const data = await res.json()
      setMessage(data.message ?? data.error ?? 'Done')
      setState(data.error ? 'error' : 'done')
    } catch (e: any) {
      setMessage(e.message)
      setState('error')
    }
    setTimeout(() => setState('idle'), 8000)
  }

  function matchLabel(m: FinishedMatch) {
    const date = new Date(m.kickoff_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    const score = m.home_score !== null ? `${m.home_score}–${m.away_score}` : '?–?'
    return `#${m.match_number ?? '?'} · ${m.home_team?.name ?? '?'} ${score} ${m.away_team?.name ?? '?'} (${date})`
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={selectedId}
        onChange={e => setSelectedId(e.target.value)}
        className="text-sm px-3 py-2 border border-gray-200 bg-white"
        style={{ fontFamily: 'Inter, sans-serif', minWidth: 280, color: '#141414' }}
      >
        <option value="">— select a finished match —</option>
        {matches.map(m => (
          <option key={m.id} value={m.id}>{matchLabel(m)}</option>
        ))}
      </select>
      <button
        onClick={handleFix}
        disabled={!selectedId || state === 'loading'}
        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-[#ff5c35] hover:bg-[#e04a26] text-white disabled:opacity-40 transition-colors"
        style={{ fontFamily: 'Inter, sans-serif' }}
      >
        {state === 'loading' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
         state === 'done'    ? <Check className="w-3.5 h-3.5" /> :
         <RefreshCw className="w-3.5 h-3.5" />}
        Reprocess predictions
      </button>
      {message && (
        <span className={`text-xs ${state === 'error' ? 'text-red-500' : 'text-green-600'}`} style={{ fontFamily: 'Inter, sans-serif' }}>
          {message}
        </span>
      )}
    </div>
  )
}
