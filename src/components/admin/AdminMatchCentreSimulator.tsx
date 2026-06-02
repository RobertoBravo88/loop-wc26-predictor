'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface SimMatch {
  id: string
  label: string
  homeTeamId: string
  awayTeamId: string
  homeTeamName: string
  awayTeamName: string
}

interface GoalEvent {
  minute: number | ''
  player_name: string
  team_id: string
  is_own_goal: boolean
}

const sans = 'Inter, sans-serif'

const inputStyle: React.CSSProperties = {
  border: '1px solid #e0dbd3', padding: '6px 10px',
  fontSize: '0.8rem', fontFamily: sans, background: '#fff',
  outline: 'none', color: '#141414',
}

type State = 'upcoming' | 'preview' | 'live' | 'finished'

export default function AdminMatchCentreSimulator({ matches }: { matches: SimMatch[] }) {
  const [matchId,    setMatchId]    = useState('')
  const [homeScore,  setHomeScore]  = useState(0)
  const [awayScore,  setAwayScore]  = useState(0)
  const [state,      setState]      = useState<State>('live')
  const [goals,      setGoals]      = useState<GoalEvent[]>([])
  const [saving,     setSaving]     = useState(false)
  const [clearing,   setClearing]   = useState(false)
  const [status,     setStatus]     = useState('')
  const [active,     setActive]     = useState(false)

  // New goal form
  const [newMin,     setNewMin]     = useState<number | ''>('')
  const [newPlayer,  setNewPlayer]  = useState('')  // player name (from dropdown or typed)
  const [newPlayerId, setNewPlayerId] = useState('') // player id for auto-team assignment
  const [newTeam,    setNewTeam]    = useState('')
  const [newOG,      setNewOG]      = useState(false)

  // Players for the selected match's teams
  const [players, setPlayers] = useState<Array<{ id: string; name: string; team_id: string; position: string | null }>>([])
  const [loadingPlayers, setLoadingPlayers] = useState(false)

  const selectedMatch = matches.find(m => m.id === matchId)

  // Load players when match changes
  useEffect(() => {
    if (!selectedMatch) { setPlayers([]); return }
    setLoadingPlayers(true)
    const supabase = createClient()
    supabase
      .from('players')
      .select('id, name, team_id, position')
      .in('team_id', [selectedMatch.homeTeamId, selectedMatch.awayTeamId])
      .order('name')
      .limit(200)
      .then(({ data }) => {
        setPlayers(data ?? [])
        setLoadingPlayers(false)
      })
  }, [matchId])

  function addGoal() {
    if (!newTeam) return
    setGoals(prev => [...prev, { minute: newMin, player_name: newPlayer, team_id: newTeam, is_own_goal: newOG }])
    setNewMin(''); setNewPlayer(''); setNewPlayerId(''); setNewOG(false)
  }

  function removeGoal(i: number) {
    setGoals(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleSave() {
    if (!matchId) { setStatus('Select a match first'); return }
    setSaving(true); setStatus('')
    const res = await fetch('/api/admin/match-centre-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId, homeScore, awayScore, state, goalEvents: goals }),
    })
    const data = await res.json()
    setSaving(false)
    if (data.error) { setStatus('Error: ' + data.error); return }
    setActive(true)
    setStatus('✓ Simulation active — visit the home page to preview')
  }

  async function handleClear() {
    setClearing(true); setStatus('')
    await fetch('/api/admin/match-centre-preview', { method: 'DELETE' })
    setClearing(false)
    setActive(false)
    setMatchId(''); setHomeScore(0); setAwayScore(0); setState('live'); setGoals([])
    setStatus('Simulation cleared')
  }

  return (
    <div className="p-5 space-y-5">

      {active && (
        <div className="px-4 py-2.5 text-xs font-semibold flex items-center justify-between"
          style={{ background: '#fef9c3', border: '1px solid #eab308', color: '#92400e', fontFamily: sans }}>
          <span>🟡 Simulation active — home page shows preview for admin</span>
          <button onClick={handleClear} disabled={clearing}
            style={{ background: '#eab308', color: '#fff', border: 'none', padding: '4px 12px', fontSize: '0.7rem', fontFamily: sans, cursor: 'pointer' }}>
            {clearing ? 'Clearing…' : 'Clear simulation'}
          </button>
        </div>
      )}

      {/* Match + state */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#6b6b6b', fontFamily: sans }}>Match</label>
          <select style={{ ...inputStyle, width: '100%' }} value={matchId} onChange={e => { setMatchId(e.target.value); setNewTeam(''); setNewPlayerId(''); setNewPlayer('') }}>
            <option value="">Select a match…</option>
            {matches.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#6b6b6b', fontFamily: sans }}>Match state</label>
          <select style={{ ...inputStyle, width: '100%' }} value={state} onChange={e => setState(e.target.value as State)}>
            <option value="upcoming">Upcoming (blurred, countdown)</option>
            <option value="preview">Preview (picks revealed, ? – ?)</option>
            <option value="live">Live (score shown)</option>
            <option value="finished">Finished (full time)</option>
          </select>
        </div>
      </div>

      {/* Score */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#6b6b6b', fontFamily: sans }}>
          Score {selectedMatch ? `— ${selectedMatch.homeTeamName} vs ${selectedMatch.awayTeamName}` : ''}
        </label>
        <div className="flex items-center gap-3">
          <input type="number" min="0" max="99" value={homeScore} onChange={e => setHomeScore(parseInt(e.target.value) || 0)}
            style={{ ...inputStyle, width: 64, textAlign: 'center' }} />
          <span style={{ color: '#e0dbd3', fontWeight: 700 }}>–</span>
          <input type="number" min="0" max="99" value={awayScore} onChange={e => setAwayScore(parseInt(e.target.value) || 0)}
            style={{ ...inputStyle, width: 64, textAlign: 'center' }} />
        </div>
      </div>

      {/* Goal events */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#6b6b6b', fontFamily: sans }}>
          Goal events ({goals.length})
        </label>

        {/* Existing goals */}
        {goals.length > 0 && (
          <div className="mb-3 space-y-1">
            {goals.map((g, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2" style={{ background: '#faf9f6', border: '1px solid #e0dbd3' }}>
                <span style={{ fontSize: '0.75rem', color: '#6b6b6b', fontFamily: sans, minWidth: 32 }}>
                  {g.minute !== '' ? `'${g.minute}` : '—'}
                </span>
                <span style={{ fontSize: '0.8rem', color: '#141414', fontFamily: sans, flex: 1 }}>
                  {g.player_name || '(unknown)'}{g.is_own_goal ? ' (og)' : ''}
                </span>
                <span style={{ fontSize: '0.7rem', color: '#9ca3af', fontFamily: sans }}>
                  {selectedMatch?.homeTeamId === g.team_id ? selectedMatch.homeTeamName : selectedMatch?.awayTeamName ?? g.team_id}
                </span>
                <button onClick={() => removeGoal(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '0 4px' }}>✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Add goal form */}
        {selectedMatch && (
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label style={{ display: 'block', fontSize: '0.65rem', textTransform: 'uppercase', color: '#9ca3af', fontFamily: sans, marginBottom: 4 }}>Min</label>
              <input type="number" min="1" max="120" value={newMin} onChange={e => setNewMin(e.target.value ? parseInt(e.target.value) : '')}
                placeholder="45" style={{ ...inputStyle, width: 52, textAlign: 'center' }} />
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label style={{ display: 'block', fontSize: '0.65rem', textTransform: 'uppercase', color: '#9ca3af', fontFamily: sans, marginBottom: 4 }}>
                Player {loadingPlayers ? '(loading…)' : ''}
              </label>
              <select
                value={newPlayerId}
                onChange={e => {
                  const selected = players.find(p => p.id === e.target.value)
                  setNewPlayerId(e.target.value)
                  setNewPlayer(selected?.name ?? '')
                  if (selected) setNewTeam(selected.team_id)
                }}
                style={{ ...inputStyle, width: '100%' }}
              >
                <option value="">Select player…</option>
                <optgroup label={selectedMatch.homeTeamName}>
                  {players.filter(p => p.team_id === selectedMatch.homeTeamId).map(p => (
                    <option key={p.id} value={p.id}>{p.name}{p.position ? ` · ${p.position}` : ''}</option>
                  ))}
                </optgroup>
                <optgroup label={selectedMatch.awayTeamName}>
                  {players.filter(p => p.team_id === selectedMatch.awayTeamId).map(p => (
                    <option key={p.id} value={p.id}>{p.name}{p.position ? ` · ${p.position}` : ''}</option>
                  ))}
                </optgroup>
              </select>
            </div>
            <div className="flex items-center gap-1.5 pb-1">
              <input type="checkbox" id="og" checked={newOG} onChange={e => setNewOG(e.target.checked)} />
              <label htmlFor="og" style={{ fontSize: '0.75rem', color: '#6b6b6b', fontFamily: sans, cursor: 'pointer' }}>OG</label>
            </div>
            <button onClick={addGoal} disabled={!newTeam}
              style={{ background: newTeam ? '#141414' : '#e0dbd3', color: '#fff', border: 'none', padding: '7px 14px', fontSize: '0.75rem', fontFamily: sans, cursor: newTeam ? 'pointer' : 'not-allowed' }}>
              + Add goal
            </button>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2" style={{ borderTop: '1px solid #e0dbd3' }}>
        <button onClick={handleSave} disabled={saving || !matchId}
          style={{ background: saving || !matchId ? '#9ca3af' : '#ff5c35', color: '#fff', border: 'none', padding: '8px 20px', fontSize: '0.8rem', fontWeight: 700, fontFamily: sans, cursor: saving || !matchId ? 'not-allowed' : 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {saving ? 'Activating…' : 'Activate simulation'}
        </button>
        {active && (
          <button onClick={handleClear} disabled={clearing}
            style={{ background: 'none', border: '1px solid #e0dbd3', color: '#6b6b6b', padding: '8px 16px', fontSize: '0.8rem', fontFamily: sans, cursor: 'pointer' }}>
            {clearing ? 'Clearing…' : 'Clear'}
          </button>
        )}
        {status && <span style={{ fontSize: '0.75rem', color: status.startsWith('✓') ? '#15803d' : '#dc2626', fontFamily: sans }}>{status}</span>}
      </div>
    </div>
  )
}
