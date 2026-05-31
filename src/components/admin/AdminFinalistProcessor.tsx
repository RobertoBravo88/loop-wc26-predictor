'use client'

import { useState } from 'react'
import { Loader2, Check, Trophy } from 'lucide-react'
import type { Team } from '@/types'

interface Props {
  teams: Team[]
}

export default function AdminFinalistProcessor({ teams }: Props) {
  const [first,  setFirst]  = useState('')
  const [second, setSecond] = useState('')
  const [third,  setThird]  = useState('')
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState<string | null>(null)
  const [error,   setError]   = useState<string | null>(null)

  const ready = first && second && third &&
    new Set([first, second, third]).size === 3  // all three must be different teams

  async function handleProcess() {
    if (!ready) return
    setLoading(true); setResult(null); setError(null)

    const res = await fetch('/api/admin/process-finalist-picks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_team_id:  first,
        second_team_id: second,
        third_team_id:  third,
      }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error ?? 'Something went wrong')
    } else {
      setResult(data.message ?? 'Done!')
    }
  }

  const selectStyle = {
    fontFamily: 'Inter, sans-serif',
    fontSize: '13px',
    color: '#141414',
    background: '#ffffff',
    border: '1px solid #e0dbd3',
    padding: '8px 12px',
    width: '100%',
    outline: 'none',
  } as const

  return (
    <section className="p-6" style={{ background: '#ffffff', border: '1px solid #e0dbd3' }}>
      <h2 className="font-bold mb-1 flex items-center gap-2 text-sm uppercase tracking-wider" style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}>
        <Trophy className="w-4 h-4 text-[#ff5c35]" /> Process finalist picks
      </h2>
      <p className="text-sm mb-4" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
        Run this <strong>once</strong> after the final. Select the actual top-3 finishers and award points to all players with correct picks.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {([
          { label: 'Winner (1st)',  value: first,  set: setFirst },
          { label: 'Runner-up (2nd)', value: second, set: setSecond },
          { label: '3rd place',    value: third,  set: setThird },
        ] as const).map(({ label, value, set }) => (
          <div key={label}>
            <label
              className="block mb-1 text-xs uppercase tracking-wider font-semibold"
              style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}
            >
              {label}
            </label>
            <select value={value} onChange={e => set(e.target.value)} style={selectStyle}>
              <option value="">Select team…</option>
              {teams.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {new Set([first, second, third].filter(Boolean)).size < new Set([first, second, third].filter(Boolean)).size + 0 && (
        <p className="text-xs text-red-500 mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
          All three picks must be different teams.
        </p>
      )}

      <button
        onClick={handleProcess}
        disabled={!ready || loading || !!result}
        className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider px-5 py-2.5 transition-colors"
        style={{
          background: !ready || loading || result ? '#e0dbd3' : '#ff5c35',
          color:      !ready || loading || result ? '#6b6b6b' : '#ffffff',
          fontFamily: 'Inter, sans-serif',
          cursor:     !ready || loading || result ? 'not-allowed' : 'pointer',
        }}
      >
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        {result  && <Check   className="w-3.5 h-3.5" />}
        {result ? 'Points awarded!' : 'Award finalist points'}
      </button>

      {result && (
        <p className="mt-2 text-xs" style={{ color: '#22c55e', fontFamily: 'Inter, sans-serif' }}>
          {result}
        </p>
      )}
      {error && (
        <p className="mt-2 text-xs" style={{ color: '#dc2626', fontFamily: 'Inter, sans-serif' }}>
          {error}
        </p>
      )}
    </section>
  )
}
