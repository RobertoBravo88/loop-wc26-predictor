'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Lock, Check, Loader2, Trophy } from 'lucide-react'
import type { Team, Player, FinalistPick, ScorerPick } from '@/types'

interface Props {
  userId: string
  teams: Team[]
  players: (Player & { team?: { name: string } })[]
  finalistPick: FinalistPick | null
  scorerPicks: (ScorerPick & { player?: { name: string; position: string }; team?: { name: string; flag_url: string } })[]
  locked: boolean
}

export default function TournamentPicksClient({ userId, teams, players, finalistPick, scorerPicks, locked }: Props) {
  const [first, setFirst] = useState(finalistPick?.first_team_id ?? '')
  const [second, setSecond] = useState(finalistPick?.second_team_id ?? '')
  const [third, setThird] = useState(finalistPick?.third_team_id ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // Scorer picks state — keyed by team_id
  const [scorerMap, setScorerMap] = useState<Map<string, string>>(
    new Map(scorerPicks.map(sp => [sp.team_id, sp.player_id]))
  )
  const [savingScorer, setSavingScorer] = useState<string | null>(null)

  async function saveFinalists() {
    if (locked || !first || !second || !third) return
    setSaving(true); setError('')
    const supabase = createClient()
    const { error: e } = await supabase.from('finalist_picks').upsert({
      user_id: userId, first_team_id: first, second_team_id: second, third_team_id: third
    }, { onConflict: 'user_id' })
    setSaving(false)
    if (e) { setError(e.message); return }
    setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  async function saveScorerPick(teamId: string, playerId: string) {
    if (locked) return
    setSavingScorer(teamId)
    const supabase = createClient()
    await supabase.from('scorer_picks').upsert({
      user_id: userId, team_id: teamId, player_id: playerId
    }, { onConflict: 'user_id,team_id' })
    setScorerMap(prev => new Map(prev).set(teamId, playerId))
    setSavingScorer(null)
  }

  const teamOptions = teams.map(t => ({ value: t.id, label: t.name, flag: t.flag_url }))

  const selectStyle = {
    fontFamily: 'Inter, sans-serif',
    fontSize: '13px',
    color: '#141414',
    background: '#ffffff',
    border: '1px solid #e0dbd3',
    borderRadius: 0,
    padding: '8px 12px',
    width: '100%',
    outline: 'none',
  } as const

  return (
    <div className="space-y-8">
      {/* Locked notice */}
      {locked && (
        <div
          className="flex items-center gap-2 px-4 py-3 text-xs uppercase tracking-wider"
          style={{
            border: '1px solid #e0dbd3',
            color: '#6b6b6b',
            fontFamily: 'Inter, sans-serif',
            background: '#faf9f7',
          }}
        >
          <Lock className="w-3.5 h-3.5 flex-shrink-0" />
          The tournament has started — picks are locked.
        </div>
      )}

      {/* Finalist picks */}
      <section>
        <h2
          className="text-xl mb-1 pb-2"
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontWeight: 700,
            color: '#141414',
            borderBottom: '1px solid #e0dbd3',
          }}
        >
          <span className="flex items-center gap-2">
            <Trophy className="w-5 h-5" style={{ color: '#ff5c35' }} />
            Who will win the World Cup?
          </span>
        </h2>
        <p className="text-xs uppercase tracking-wider mt-3 mb-4" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
          Pick the winner, runner-up, and third place. Locks when the tournament starts.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          {[
            { label: 'Winner', value: first, set: setFirst, pts: 300 },
            { label: 'Runner-up', value: second, set: setSecond, pts: 200 },
            { label: '3rd place', value: third, set: setThird, pts: 100 },
          ].map(pick => (
            <div key={pick.label}>
              <label
                className="block mb-1.5 uppercase tracking-wider"
                style={{ fontSize: '10px', fontWeight: 600, color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}
              >
                {pick.label} &middot; <span style={{ color: '#ff5c35' }}>+{pick.pts} pts</span>
              </label>
              <select
                value={pick.value}
                onChange={e => { pick.set(e.target.value); setSaved(false) }}
                disabled={locked}
                style={{ ...selectStyle, opacity: locked ? 0.5 : 1, cursor: locked ? 'not-allowed' : 'default' }}
              >
                <option value="">Select team…</option>
                {teamOptions.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {!locked && (
          <div className="flex items-center justify-between">
            {error && (
              <p className="text-xs" style={{ color: '#e04a26', fontFamily: 'Inter, sans-serif' }}>{error}</p>
            )}
            <div className="ml-auto">
              <button
                onClick={saveFinalists}
                disabled={saving || !first || !second || !third}
                className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider px-5 py-2.5 transition-colors"
                style={{
                  background: saving || !first || !second || !third ? '#e0dbd3' : '#141414',
                  color: saving || !first || !second || !third ? '#6b6b6b' : '#ffffff',
                  fontFamily: 'Inter, sans-serif',
                  borderRadius: 0,
                  cursor: saving || !first || !second || !third ? 'not-allowed' : 'pointer',
                }}
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {saved && <Check className="w-3.5 h-3.5" />}
                {saved ? 'Saved!' : 'Save picks'}
              </button>
            </div>
          </div>
        )}

        {locked && finalistPick && (
          <div
            className="flex items-center gap-2 mt-2 text-xs uppercase tracking-wider"
            style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}
          >
            <Lock className="w-3.5 h-3.5" /> Picks locked at tournament start
          </div>
        )}
      </section>

      {/* Goal scorer picks */}
      <section>
        <h2
          className="text-xl mb-1 pb-2"
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontWeight: 700,
            color: '#141414',
            borderBottom: '1px solid #e0dbd3',
          }}
        >
          Goal scorer picks
        </h2>
        <p
          className="text-xs uppercase tracking-wider mt-3 mb-4"
          style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}
        >
          Pick one player per team &middot; +10 pts every time they score
        </p>

        <div style={{ border: '1px solid #e0dbd3' }}>
          {teams.map((team, idx) => {
            const teamPlayers = players.filter(p => p.team_id === team.id)
            const currentPick = scorerMap.get(team.id) ?? ''
            const isSaving = savingScorer === team.id

            return (
              <div
                key={team.id}
                className="flex items-center gap-3 px-4 py-3"
                style={{
                  borderBottom: idx < teams.length - 1 ? '1px solid #e0dbd3' : 'none',
                  background: '#ffffff',
                }}
              >
                {team.flag_url && (
                  <img src={team.flag_url} alt="" className="w-7 h-5 object-cover flex-shrink-0" />
                )}
                <span
                  className="w-32 flex-shrink-0 truncate"
                  style={{ fontSize: '13px', fontWeight: 500, color: '#141414', fontFamily: 'Inter, sans-serif' }}
                >
                  {team.name}
                </span>
                <select
                  value={currentPick}
                  onChange={e => saveScorerPick(team.id, e.target.value)}
                  disabled={locked || isSaving || teamPlayers.length === 0}
                  style={{
                    ...selectStyle,
                    flex: 1,
                    opacity: locked || teamPlayers.length === 0 ? 0.5 : 1,
                    cursor: locked || teamPlayers.length === 0 ? 'not-allowed' : 'default',
                  }}
                >
                  <option value="">{teamPlayers.length === 0 ? 'Squad not loaded' : 'Pick a player…'}</option>
                  {teamPlayers.map(p => (
                    <option key={p.id} value={p.id}>{p.name}{p.position ? ` · ${p.position}` : ''}</option>
                  ))}
                </select>
                {isSaving && <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" style={{ color: '#ff5c35' }} />}
                {!isSaving && currentPick && <Check className="w-4 h-4 flex-shrink-0" style={{ color: '#2d7a2d' }} />}
              </div>
            )
          })}
          {!teams.length && (
            <p
              className="text-center py-8 text-xs uppercase tracking-wider"
              style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}
            >
              Teams will appear here once loaded.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
