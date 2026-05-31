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

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Tournament Picks</h1>
        <p className="text-sm text-gray-500">
          {locked
            ? '🔒 The tournament has started — picks are locked.'
            : 'These picks lock when the tournament starts. Choose wisely!'}
        </p>
      </div>

      {/* Finalist picks */}
      <section className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          Who will win the World Cup?
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          {[
            { label: '🥇 Winner', value: first, set: setFirst, pts: 300 },
            { label: '🥈 Runner-up', value: second, set: setSecond, pts: 200 },
            { label: '🥉 3rd place', value: third, set: setThird, pts: 100 },
          ].map(pick => (
            <div key={pick.label}>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                {pick.label} · <span className="text-[#ff5c35]">+{pick.pts} pts</span>
              </label>
              <select
                value={pick.value}
                onChange={e => { pick.set(e.target.value); setSaved(false) }}
                disabled={locked}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5c35] bg-white disabled:opacity-50"
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
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="ml-auto">
              <button onClick={saveFinalists} disabled={saving || !first || !second || !third}
                className="bg-[#ff5c35] hover:bg-[#e04a26] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : null}
                {saved ? 'Saved!' : 'Save picks'}
              </button>
            </div>
          </div>
        )}
        {locked && finalistPick && (
          <div className="flex items-center gap-2 text-sm text-gray-500 mt-2">
            <Lock className="w-3.5 h-3.5" /> Picks locked at tournament start
          </div>
        )}
      </section>

      {/* Goal scorer picks */}
      <section>
        <h2 className="font-bold text-gray-900 mb-1">Goal scorer picks</h2>
        <p className="text-sm text-gray-500 mb-4">Pick one player per team. +10 pts every time they score.</p>

        <div className="space-y-3">
          {teams.map(team => {
            const teamPlayers = players.filter(p => p.team_id === team.id)
            const currentPick = scorerMap.get(team.id) ?? ''
            const isSaving = savingScorer === team.id

            return (
              <div key={team.id} className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-3">
                {team.flag_url && <img src={team.flag_url} alt="" className="w-7 h-5 object-cover rounded-sm flex-shrink-0" />}
                <span className="text-sm font-medium text-gray-700 w-32 flex-shrink-0 truncate">{team.name}</span>
                <select
                  value={currentPick}
                  onChange={e => saveScorerPick(team.id, e.target.value)}
                  disabled={locked || isSaving || teamPlayers.length === 0}
                  className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5c35] bg-white disabled:opacity-50"
                >
                  <option value="">{teamPlayers.length === 0 ? 'Squad not loaded' : 'Pick a player…'}</option>
                  {teamPlayers.map(p => (
                    <option key={p.id} value={p.id}>{p.name}{p.position ? ` · ${p.position}` : ''}</option>
                  ))}
                </select>
                {isSaving && <Loader2 className="w-4 h-4 animate-spin text-[#ff5c35] flex-shrink-0" />}
                {!isSaving && currentPick && <Check className="w-4 h-4 text-green-500 flex-shrink-0" />}
              </div>
            )
          })}
          {!teams.length && (
            <p className="text-sm text-gray-400 text-center py-8">Teams will appear here once loaded.</p>
          )}
        </div>
      </section>
    </div>
  )
}
