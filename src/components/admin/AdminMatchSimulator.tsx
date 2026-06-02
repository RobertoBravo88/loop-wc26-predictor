'use client'

import { useState } from 'react'

interface SimMatch {
  id: string
  label: string  // "Group A — Brazil vs Morocco (15 Jun)"
}

interface SimResult {
  userId: string
  name: string
  predicted: string
  isExact: boolean
  isCorrectOutcome: boolean
  base: number
  streak: number
  total: number
  currentStreak: number
  alreadyProcessed: boolean
}

interface SimResponse {
  match: { home: string; away: string; simScore: string }
  totalPredictions: number
  results: SimResult[]
}

const sans = 'Inter, sans-serif'

export default function AdminMatchSimulator({ matches }: { matches: SimMatch[] }) {
  const [matchId,   setMatchId]   = useState('')
  const [homeScore, setHomeScore] = useState('')
  const [awayScore, setAwayScore] = useState('')
  const [loading,   setLoading]   = useState(false)
  const [result,    setResult]    = useState<SimResponse | null>(null)
  const [error,     setError]     = useState('')

  async function simulate() {
    if (!matchId || homeScore === '' || awayScore === '') {
      setError('Select a match and enter both scores'); return
    }
    setLoading(true); setError(''); setResult(null)
    try {
      const res  = await fetch('/api/admin/simulate-match', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ matchId, homeScore: parseInt(homeScore), awayScore: parseInt(awayScore) }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      setResult(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    border: '1px solid #e0dbd3',
    padding: '7px 10px',
    fontSize: '0.8rem',
    fontFamily: sans,
    outline: 'none',
    background: '#ffffff',
    color: '#141414',
  }

  return (
    <div className="p-5">
      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-end mb-4">
        <div style={{ flex: '1 1 280px' }}>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#6b6b6b', fontFamily: sans }}>
            Match
          </label>
          <select style={{ ...inputStyle, width: '100%' }} value={matchId} onChange={e => { setMatchId(e.target.value); setResult(null) }}>
            <option value="">Select a match…</option>
            {matches.map(m => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#6b6b6b', fontFamily: sans }}>
            Home
          </label>
          <input
            type="number" min="0" max="20" value={homeScore}
            onChange={e => { setHomeScore(e.target.value); setResult(null) }}
            style={{ ...inputStyle, width: '60px', textAlign: 'center' }}
            placeholder="0"
          />
        </div>

        <span className="text-lg font-bold pb-1" style={{ color: '#e0dbd3' }}>–</span>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#6b6b6b', fontFamily: sans }}>
            Away
          </label>
          <input
            type="number" min="0" max="20" value={awayScore}
            onChange={e => { setAwayScore(e.target.value); setResult(null) }}
            style={{ ...inputStyle, width: '60px', textAlign: 'center' }}
            placeholder="0"
          />
        </div>

        <button
          onClick={simulate}
          disabled={loading}
          style={{
            background: loading ? '#6b6b6b' : '#ff5c35',
            color: '#ffffff',
            border: 'none',
            padding: '8px 20px',
            fontSize: '0.8rem',
            fontWeight: 700,
            fontFamily: sans,
            cursor: loading ? 'not-allowed' : 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '1px',
          }}
        >
          {loading ? 'Calculating…' : 'Simulate'}
        </button>
      </div>

      {error && (
        <p className="text-xs mb-3" style={{ color: '#dc2626', fontFamily: sans }}>{error}</p>
      )}

      {/* Results */}
      {result && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#141414', fontFamily: sans }}>
            Simulated result: {result.match.home} {result.match.simScore} {result.match.away}
            <span className="ml-2 font-normal normal-case" style={{ color: '#6b6b6b' }}>
              — {result.totalPredictions} predictions
            </span>
          </p>

          <div style={{ border: '1px solid #e0dbd3' }}>
            {/* Header */}
            <div
              className="grid px-4 py-2 text-xs font-semibold uppercase tracking-wider"
              style={{
                background: '#141414',
                color: '#ffffff',
                fontFamily: sans,
                gridTemplateColumns: '1fr 6rem 5rem 5rem 5rem 5rem',
                borderBottom: '1px solid #e0dbd3',
              }}
            >
              <span>Looper</span>
              <span className="text-center">Their pick</span>
              <span className="text-center">Outcome</span>
              <span className="text-center">Base pts</span>
              <span className="text-center">🔥 Bonus</span>
              <span className="text-center">Total</span>
            </div>

            {result.results.map((r, i) => (
              <div
                key={r.userId}
                className="grid px-4 py-2.5 items-center text-sm"
                style={{
                  gridTemplateColumns: '1fr 6rem 5rem 5rem 5rem 5rem',
                  background: i % 2 === 0 ? '#ffffff' : '#faf9f6',
                  borderBottom: '1px solid #e0dbd3',
                  opacity: r.alreadyProcessed ? 0.5 : 1,
                }}
              >
                <span style={{ fontFamily: sans, color: '#141414', fontWeight: 500 }}>
                  {r.name}
                  {r.alreadyProcessed && (
                    <span className="ml-1 text-xs" style={{ color: '#9ca3af' }}>(already processed)</span>
                  )}
                </span>
                <span className="text-center" style={{ fontFamily: sans, color: '#6b6b6b' }}>{r.predicted}</span>
                <span
                  className="text-center text-xs font-semibold"
                  style={{
                    color: r.isExact ? '#15803d' : r.isCorrectOutcome ? '#a16207' : '#6b6b6b',
                    fontFamily: sans,
                  }}
                >
                  {r.isExact ? '✓ Exact' : r.isCorrectOutcome ? '✓ Outcome' : '✗ Miss'}
                </span>
                <span className="text-center font-bold" style={{ fontFamily: sans, color: r.base > 0 ? '#141414' : '#e0dbd3' }}>
                  {r.base > 0 ? `+${r.base}` : '—'}
                </span>
                <span className="text-center font-bold" style={{ fontFamily: sans, color: r.streak > 0 ? '#ff5c35' : '#e0dbd3' }}>
                  {r.streak > 0 ? `+${r.streak}` : '—'}
                </span>
                <span className="text-center font-bold" style={{ fontFamily: sans, color: r.total > 0 ? '#ff5c35' : '#6b6b6b' }}>
                  {r.total > 0 ? `+${r.total}` : '0'}
                </span>
              </div>
            ))}

            {result.results.length === 0 && (
              <div className="px-4 py-8 text-center text-sm" style={{ color: '#6b6b6b', fontFamily: sans }}>
                No predictions submitted for this match yet.
              </div>
            )}
          </div>

          <p className="text-xs mt-2" style={{ color: '#9ca3af', fontFamily: sans }}>
            🔮 Dry run — no data was written. Golden Boots and 12th Man bonuses not included (those depend on goal events).
          </p>
        </div>
      )}
    </div>
  )
}
