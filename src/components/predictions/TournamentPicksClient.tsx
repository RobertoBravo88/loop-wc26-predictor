'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Lock, Check, Loader2, Trophy, X, AlertCircle } from 'lucide-react'
import type { Team, Player, FinalistPick, ScorerPick } from '@/types'

interface Props {
  userId: string
  teams: Team[]
  players: (Player & { team?: { name: string } })[]
  finalistPick: FinalistPick | null
  scorerPicks: (ScorerPick & { player?: { name: string; position: string }; team?: { name: string; flag_url: string } })[]
  favTeamId: string | null
  favPlayerId: string | null
  locked: boolean
}

type ScorerPickItem = { teamId: string; playerId: string }

export default function TournamentPicksClient({ userId, teams, players, finalistPick, scorerPicks, favTeamId, favPlayerId, locked }: Props) {
  const [first, setFirst] = useState(finalistPick?.first_team_id ?? '')
  const [second, setSecond] = useState(finalistPick?.second_team_id ?? '')
  const [third, setThird] = useState(finalistPick?.third_team_id ?? '')
  const [finalistSaving, setFinalistSaving] = useState(false)
  const [finalistSaved,  setFinalistSaved]  = useState(false)
  const [finalistError,  setFinalistError]  = useState(false)
  const finalistDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Secret bonus picks
  const [favTeam, setFavTeam] = useState(favTeamId ?? '')
  const [favPlayer, setFavPlayer] = useState(favPlayerId ?? '')
  const [favPlayerTeam, setFavPlayerTeam] = useState<string>(() => {
    if (!favPlayerId) return ''
    return players.find(p => p.id === favPlayerId)?.team_id ?? ''
  })
  const [secretsSaving, setSecretsSaving] = useState(false)
  const [secretsSaved,  setSecretsSaved]  = useState(false)
  const [secretsError,  setSecretsError]  = useState(false)
  const secretsDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Scorer picks — array of up to 5 items
  const [picks, setPicks] = useState<ScorerPickItem[]>(
    scorerPicks.slice(0, 5).map(sp => ({ teamId: sp.team_id, playerId: sp.player_id }))
  )
  const [addingTeam, setAddingTeam] = useState('')
  const [addingPlayer, setAddingPlayer] = useState('')
  const [savingScorer, setSavingScorer] = useState(false)
  const [removingTeam, setRemovingTeam] = useState<string | null>(null)

  function triggerFinalistSave(f: string, s: string, t: string) {
    if (locked || !f || !s || !t) return
    if (finalistDebounce.current) clearTimeout(finalistDebounce.current)
    finalistDebounce.current = setTimeout(async () => {
      setFinalistSaving(true); setFinalistError(false)
      const supabase = createClient()
      const { error: e } = await supabase.from('finalist_picks').upsert({
        user_id: userId, first_team_id: f, second_team_id: s, third_team_id: t
      }, { onConflict: 'user_id' })
      setFinalistSaving(false)
      if (e) { setFinalistError(true); setTimeout(() => setFinalistError(false), 4000) }
      else    { setFinalistSaved(true);  setTimeout(() => setFinalistSaved(false),  2000) }
    }, 600)
  }

  async function addScorerPick(teamId: string, playerId: string) {
    if (locked || picks.length >= 5) return
    setSavingScorer(true)
    const supabase = createClient()
    await supabase.from('scorer_picks').upsert({
      user_id: userId, team_id: teamId, player_id: playerId
    }, { onConflict: 'user_id,team_id' })
    setPicks(prev => [...prev, { teamId, playerId }])
    setAddingTeam('')
    setAddingPlayer('')
    setSavingScorer(false)
  }

  async function removeScorerPick(teamId: string) {
    if (locked) return
    setRemovingTeam(teamId)
    const supabase = createClient()
    await supabase.from('scorer_picks').delete().eq('user_id', userId).eq('team_id', teamId)
    setPicks(prev => prev.filter(p => p.teamId !== teamId))
    setRemovingTeam(null)
    // If the user was in the middle of adding a pick from this team, reset that too
    if (addingTeam === teamId) {
      setAddingTeam('')
      setAddingPlayer('')
    }
  }

  function triggerSecretsSave(team: string, player: string) {
    if (locked) return
    if (secretsDebounce.current) clearTimeout(secretsDebounce.current)
    secretsDebounce.current = setTimeout(async () => {
      setSecretsSaving(true); setSecretsError(false)
      const supabase = createClient()
      const { error: e } = await supabase
        .from('profiles')
        .update({ favourite_team_id: team || null, favourite_player_id: player || null })
        .eq('id', userId)
      setSecretsSaving(false)
      if (e) { setSecretsError(true); setTimeout(() => setSecretsError(false), 4000) }
      else   { setSecretsSaved(true);  setTimeout(() => setSecretsSaved(false),  2000) }
    }, 600)
  }

  const teamOptions = teams.map(t => ({ value: t.id, label: t.name, flag: t.flag_url }))

  // Teams not yet in picks (for the add-a-pick dropdown)
  const pickedTeamIds = new Set(picks.map(p => p.teamId))
  const availableTeams = teams.filter(t => !pickedTeamIds.has(t.id))

  // Players for the currently selected team in the add flow
  const addingTeamPlayers = players.filter(p => p.team_id === addingTeam)

  // Players for favourite player team
  const favPlayerTeamPlayers = players.filter(p => p.team_id === favPlayerTeam)

  // Helper: get team info from teams array
  function getTeam(teamId: string) {
    return teams.find(t => t.id === teamId)
  }

  // Helper: get player name from players array
  function getPlayerName(playerId: string) {
    return players.find(p => p.id === playerId)?.name ?? playerId
  }

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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-3">
          {[
            { label: 'Winner',    value: first,  set: (v: string) => { setFirst(v);  triggerFinalistSave(v, second, third)  }, pts: 300 },
            { label: 'Runner-up', value: second, set: (v: string) => { setSecond(v); triggerFinalistSave(first, v, third)   }, pts: 200 },
            { label: '3rd place', value: third,  set: (v: string) => { setThird(v);  triggerFinalistSave(first, second, v)  }, pts: 100 },
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
                onChange={e => pick.set(e.target.value)}
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

        {/* Auto-save status */}
        {!locked && (
          <div className="flex items-center gap-1.5 h-5">
            {finalistSaving && <><Loader2 className="w-3 h-3 animate-spin" style={{ color: '#6b6b6b' }} /><span className="text-xs" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>Saving…</span></>}
            {finalistSaved  && !finalistSaving && <><Check className="w-3 h-3" style={{ color: '#15803d' }} /><span className="text-xs" style={{ color: '#15803d', fontFamily: 'Inter, sans-serif' }}>Saved</span></>}
            {finalistError  && <><AlertCircle className="w-3 h-3" style={{ color: '#dc2626' }} /><span className="text-xs" style={{ color: '#dc2626', fontFamily: 'Inter, sans-serif' }}>Save failed — try again</span></>}
            {!finalistSaving && !finalistSaved && !finalistError && first && second && third && (
              <span className="text-xs" style={{ color: '#9ca3af', fontFamily: 'Inter, sans-serif' }}>Auto-saves when all 3 are selected</span>
            )}
            {!finalistSaving && !finalistSaved && !finalistError && (!first || !second || !third) && (
              <span className="text-xs" style={{ color: '#9ca3af', fontFamily: 'Inter, sans-serif' }}>Select all 3 to save</span>
            )}
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
        {/* Section header with counter badge */}
        <div className="flex items-center justify-between mb-1 pb-2" style={{ borderBottom: '1px solid #e0dbd3' }}>
          <h2
            className="text-xl"
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontWeight: 700,
              color: '#141414',
            }}
          >
            Your 5 Goal Scorers
          </h2>
          <span
            className="text-xs font-semibold uppercase tracking-wider px-3 py-1"
            style={{
              fontFamily: 'Inter, sans-serif',
              background: picks.length === 5 ? '#141414' : '#faf9f7',
              color: picks.length === 5 ? '#ffffff' : '#6b6b6b',
              border: '1px solid #e0dbd3',
            }}
          >
            {picks.length} / 5 picks
          </span>
        </div>
        <p
          className="text-xs uppercase tracking-wider mt-3 mb-5"
          style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}
        >
          Pick up to 5 players &middot; one per country max &middot; <span style={{ color: '#ff5c35' }}>+10 pts every time they score</span>
        </p>

        {/* 5 numbered pick slots */}
        <div className="space-y-2 mb-5">
          {Array.from({ length: 5 }).map((_, idx) => {
            const pick = picks[idx]
            const team = pick ? getTeam(pick.teamId) : undefined
            const isRemoving = pick ? removingTeam === pick.teamId : false

            return (
              <div
                key={idx}
                className="flex items-center gap-3 px-4 py-3"
                style={{
                  border: pick ? '1px solid #e0dbd3' : '1px dashed #e0dbd3',
                  background: pick ? '#ffffff' : '#faf9f7',
                  minHeight: '52px',
                }}
              >
                {/* Slot number */}
                <span
                  className="w-5 text-center flex-shrink-0 font-semibold"
                  style={{ fontSize: '11px', color: pick ? '#141414' : '#c4bfb8', fontFamily: 'Inter, sans-serif' }}
                >
                  {idx + 1}
                </span>

                {pick ? (
                  <>
                    {/* Flag */}
                    {team?.flag_url && (
                      <img src={team.flag_url} alt="" className="w-7 h-5 object-contain flex-shrink-0" />
                    )}
                    {/* Player name + team */}
                    <div className="flex-1 min-w-0">
                      <span
                        className="block truncate"
                        style={{ fontSize: '13px', fontWeight: 500, color: '#141414', fontFamily: 'Inter, sans-serif' }}
                      >
                        {getPlayerName(pick.playerId)}
                      </span>
                      <span
                        className="block truncate"
                        style={{ fontSize: '11px', color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}
                      >
                        {team?.name ?? ''}
                      </span>
                    </div>
                    {/* Remove button */}
                    {!locked && (
                      <button
                        onClick={() => removeScorerPick(pick.teamId)}
                        disabled={isRemoving}
                        className="flex-shrink-0 flex items-center justify-center w-6 h-6 transition-colors"
                        style={{
                          color: '#6b6b6b',
                          cursor: isRemoving ? 'not-allowed' : 'pointer',
                        }}
                        aria-label="Remove pick"
                      >
                        {isRemoving
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <X className="w-3.5 h-3.5" />
                        }
                      </button>
                    )}
                  </>
                ) : (
                  <span
                    style={{ fontSize: '12px', color: '#c4bfb8', fontFamily: 'Inter, sans-serif' }}
                  >
                    Empty slot
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* Add a pick */}
        {!locked && picks.length < 5 && (
          <div
            className="px-4 py-4"
            style={{ border: '1px solid #e0dbd3', background: '#faf9f7' }}
          >
            <p
              className="text-xs uppercase tracking-wider mb-3"
              style={{ fontWeight: 600, color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}
            >
              Add a pick
            </p>

            {/* Step 1: pick a team */}
            <div className="mb-3">
              <label
                className="block mb-1.5 uppercase tracking-wider"
                style={{ fontSize: '10px', fontWeight: 600, color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}
              >
                Country
              </label>
              <select
                value={addingTeam}
                onChange={e => { setAddingTeam(e.target.value); setAddingPlayer('') }}
                style={selectStyle}
              >
                <option value="">Select a country…</option>
                {availableTeams.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* Step 2: pick a player (shown once a team is selected) */}
            {addingTeam && (
              <div>
                <label
                  className="block mb-1.5 uppercase tracking-wider"
                  style={{ fontSize: '10px', fontWeight: 600, color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}
                >
                  Player
                </label>
                {addingTeamPlayers.length === 0 ? (
                  <p
                    className="text-xs uppercase tracking-wider py-2"
                    style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}
                  >
                    Squads not loaded yet
                  </p>
                ) : (
                  <div className="flex items-center gap-3">
                    <select
                      value={addingPlayer}
                      onChange={e => setAddingPlayer(e.target.value)}
                      style={{ ...selectStyle, flex: 1 }}
                    >
                      <option value="">Pick a player…</option>
                      {addingTeamPlayers.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name}{p.position ? ` · ${p.position}` : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => { if (addingTeam && addingPlayer) addScorerPick(addingTeam, addingPlayer) }}
                      disabled={!addingPlayer || savingScorer}
                      className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider px-4 py-2 flex-shrink-0 transition-colors"
                      style={{
                        background: !addingPlayer || savingScorer ? '#e0dbd3' : '#141414',
                        color: !addingPlayer || savingScorer ? '#6b6b6b' : '#ffffff',
                        fontFamily: 'Inter, sans-serif',
                        borderRadius: 0,
                        cursor: !addingPlayer || savingScorer ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {savingScorer
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : 'Add'
                      }
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {locked && picks.length === 0 && (
          <p
            className="text-xs uppercase tracking-wider py-2"
            style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}
          >
            No scorer picks were saved before the tournament started.
          </p>
        )}
      </section>

      {/* Secret bonus picks */}
      <section>
        <div className="flex items-center justify-between mb-1 pb-2" style={{ borderBottom: '1px solid #e0dbd3' }}>
          <h2
            className="text-xl"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, color: '#141414' }}
          >
            🤫 Secret Bonuses
          </h2>
        </div>
        <p className="text-xs uppercase tracking-wider mt-3 mb-5" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
          Hidden from everyone until the tournament starts &middot; <span style={{ color: '#ff5c35' }}>+10 pts every time they score</span>
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-4">

          {/* Favourite team */}
          <div>
            <label
              className="block mb-1.5 uppercase tracking-wider"
              style={{ fontSize: '10px', fontWeight: 600, color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}
            >
              Favourite team &middot; <span style={{ color: '#ff5c35' }}>+10 pts per team goal</span>
            </label>
            <select
              value={favTeam}
              onChange={e => { const v = e.target.value; setFavTeam(v); triggerSecretsSave(v, favPlayer) }}
              disabled={locked}
              style={{ ...selectStyle, opacity: locked ? 0.5 : 1, cursor: locked ? 'not-allowed' : 'default' }}
            >
              <option value="">Select a team…</option>
              {teams.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Favourite player — two-step */}
          <div>
            <label
              className="block mb-1.5 uppercase tracking-wider"
              style={{ fontSize: '10px', fontWeight: 600, color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}
            >
              Favourite player &middot; <span style={{ color: '#ff5c35' }}>+10 pts per player goal</span>
            </label>

            {/* Show current selection if already picked */}
            {favPlayer && !locked ? (
              <div
                className="flex items-center gap-3 px-3 py-2 mb-2"
                style={{ border: '1px solid #e0dbd3', background: '#ffffff' }}
              >
                {getTeam(favPlayerTeam || players.find(p => p.id === favPlayer)?.team_id ?? '')?.flag_url && (
                  <img
                    src={getTeam(favPlayerTeam || players.find(p => p.id === favPlayer)?.team_id ?? '')!.flag_url!}
                    alt=""
                    className="w-6 h-4 object-contain flex-shrink-0"
                  />
                )}
                <span className="flex-1 text-sm" style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}>
                  {players.find(p => p.id === favPlayer)?.name ?? '—'}
                </span>
                <button
                  onClick={() => { setFavPlayer(''); setFavPlayerTeam(''); triggerSecretsSave(favTeam, '') }}
                  className="flex-shrink-0"
                  style={{ color: '#6b6b6b', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  aria-label="Clear player"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : null}

            {(!favPlayer || locked) && (
              <>
                {/* Step 1: country */}
                <select
                  value={favPlayerTeam}
                  onChange={e => { setFavPlayerTeam(e.target.value); setFavPlayer(''); setSavedSecrets(false) }}
                  disabled={locked}
                  style={{ ...selectStyle, marginBottom: '0.5rem', opacity: locked ? 0.5 : 1, cursor: locked ? 'not-allowed' : 'default' }}
                >
                  <option value="">Select a country…</option>
                  {teams.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>

                {/* Step 2: player */}
                {favPlayerTeam && !locked && (
                  favPlayerTeamPlayers.length === 0 ? (
                    <p className="text-xs uppercase tracking-wider" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
                      Squads not loaded yet
                    </p>
                  ) : (
                    <select
                      value={favPlayer}
                      onChange={e => { const v = e.target.value; setFavPlayer(v); triggerSecretsSave(favTeam, v) }}
                      style={selectStyle}
                    >
                      <option value="">Pick a player…</option>
                      {favPlayerTeamPlayers.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name}{p.position ? ` · ${p.position}` : ''}
                        </option>
                      ))}
                    </select>
                  )
                )}

                {locked && (
                  <p className="text-xs uppercase tracking-wider" style={{ color: '#9ca3af', fontFamily: 'Inter, sans-serif' }}>
                    {favPlayerId ? players.find(p => p.id === favPlayerId)?.name ?? '—' : 'Not set'}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Auto-save status */}
        {!locked && (
          <div className="flex items-center gap-1.5 h-5">
            {secretsSaving && <><Loader2 className="w-3 h-3 animate-spin" style={{ color: '#6b6b6b' }} /><span className="text-xs" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>Saving…</span></>}
            {secretsSaved  && !secretsSaving && <><Check className="w-3 h-3" style={{ color: '#15803d' }} /><span className="text-xs" style={{ color: '#15803d', fontFamily: 'Inter, sans-serif' }}>Saved</span></>}
            {secretsError  && <><AlertCircle className="w-3 h-3" style={{ color: '#dc2626' }} /><span className="text-xs" style={{ color: '#dc2626', fontFamily: 'Inter, sans-serif' }}>Save failed — try again</span></>}
          </div>
        )}

        {locked && (
          <div
            className="flex items-center gap-2 mt-2 text-xs uppercase tracking-wider"
            style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}
          >
            <Lock className="w-3.5 h-3.5" /> Secret picks locked at tournament start
          </div>
        )}
      </section>
    </div>
  )
}
