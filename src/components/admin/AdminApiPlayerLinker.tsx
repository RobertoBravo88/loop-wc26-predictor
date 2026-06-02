'use client'
import { useState } from 'react'

export interface PlayerRow {
  id: string
  name: string
  position: string | null
  team_name: string | null
  team_flag: string | null
  api_id: number | null
  api_player_name?: string | null
  api_player_shirt?: number | null
}

export interface ApiPlayerRow {
  api_id: number
  name: string
  team_id: string
  shirt_number: number | null
}

interface Props {
  players: PlayerRow[]
  apiPlayers: ApiPlayerRow[]
}

const sans = 'Inter, sans-serif'

type Filter = 'all' | 'unlinked'

export default function AdminApiPlayerLinker({ players: initialPlayers, apiPlayers }: Props) {
  const [players, setPlayers] = useState(initialPlayers)
  const [filter, setFilter] = useState<Filter>('unlinked')
  const [search, setSearch] = useState<Record<string, string>>({})
  const [statusMsg, setStatusMsg] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})

  // Auto-link state
  const [autoLinking, setAutoLinking] = useState(false)
  const [autoResult, setAutoResult] = useState<string | null>(null)

  const linked   = players.filter(p => p.api_id !== null).length
  const total    = players.length
  const unlinked = total - linked

  const visible = filter === 'unlinked'
    ? [...players].sort((a, b) => (a.api_id !== null ? 1 : 0) - (b.api_id !== null ? 1 : 0) || a.name.localeCompare(b.name))
        .filter(p => p.api_id === null)
    : [...players].sort((a, b) => (a.api_id !== null ? 1 : 0) - (b.api_id !== null ? 1 : 0) || a.name.localeCompare(b.name))

  function getApiOptions(player: PlayerRow): ApiPlayerRow[] {
    const q = (search[player.id] ?? '').toLowerCase().trim()
    // Filter api_players to same team or all if no team match
    const teamFiltered = apiPlayers.filter(ap => ap.team_id === getTeamIdForPlayer(player))
    const pool = teamFiltered.length > 0 ? teamFiltered : apiPlayers
    if (!q) return pool.slice(0, 30)
    return pool.filter(ap => ap.name.toLowerCase().includes(q)).slice(0, 30)
  }

  // We don't have team_id on PlayerRow directly; derive from api_players not available,
  // but we can skip team-scoping and let the admin search freely across all api_players.
  function getTeamIdForPlayer(_player: PlayerRow): string {
    // PlayerRow doesn't carry team_id — show all api_players and let admin filter by name
    return ''
  }

  async function handleLink(playerId: string, apiPlayerApiId: number) {
    setLoading(prev => ({ ...prev, [playerId]: true }))
    setStatusMsg(prev => ({ ...prev, [playerId]: '' }))
    try {
      const res = await fetch('/api/admin/link-player-api', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, apiPlayerApiId }),
      })
      const data = await res.json()
      if (data.error) {
        setStatusMsg(prev => ({ ...prev, [playerId]: `Error: ${data.error}` }))
        return
      }
      // Update local state
      const linkedAp = apiPlayers.find(ap => ap.api_id === apiPlayerApiId)
      setPlayers(prev => prev.map(p => p.id === playerId
        ? { ...p, api_id: apiPlayerApiId, api_player_name: linkedAp?.name ?? null, api_player_shirt: linkedAp?.shirt_number ?? null }
        : p
      ))
      setStatusMsg(prev => ({ ...prev, [playerId]: '' }))
      setSearch(prev => ({ ...prev, [playerId]: '' }))
    } catch (e: any) {
      setStatusMsg(prev => ({ ...prev, [playerId]: `Error: ${e.message}` }))
    } finally {
      setLoading(prev => ({ ...prev, [playerId]: false }))
    }
  }

  async function handleUnlink(playerId: string) {
    if (!confirm('Remove the api link for this player?')) return
    setLoading(prev => ({ ...prev, [playerId]: true }))
    try {
      const res = await fetch('/api/admin/link-player-api', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId }),
      })
      const data = await res.json()
      if (data.error) { alert(data.error); return }
      setPlayers(prev => prev.map(p => p.id === playerId
        ? { ...p, api_id: null, api_player_name: null, api_player_shirt: null }
        : p
      ))
    } catch (e: any) {
      alert('Unlink failed: ' + e.message)
    } finally {
      setLoading(prev => ({ ...prev, [playerId]: false }))
    }
  }

  async function handleAutoLink() {
    if (!confirm(`Auto-link ${unlinked} unlinked players against api_players? This may take ~2 minutes.`)) return
    setAutoLinking(true)
    setAutoResult(null)
    try {
      const res  = await fetch('/api/admin/auto-link-internal', { method: 'POST' })
      const data = await res.json()
      if (data.error) { alert(data.error); return }
      setAutoResult(data.message ?? 'Done')
      if ((data.totalLinked ?? 0) > 0) {
        window.location.reload()
      }
    } catch (e: any) {
      alert('Auto-link failed: ' + e.message)
    } finally {
      setAutoLinking(false)
    }
  }

  return (
    <div className="p-5">

      {/* Header stats + controls */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <span className="text-sm font-semibold" style={{ fontFamily: sans, color: '#141414' }}>
          {linked} linked / {total} total
          {unlinked > 0 && (
            <span className="ml-2" style={{ color: '#ff5c35' }}>({unlinked} unlinked)</span>
          )}
        </span>

        {/* Filter */}
        <select
          value={filter}
          onChange={e => setFilter(e.target.value as Filter)}
          style={{
            border: '1px solid #e0dbd3', padding: '6px 10px',
            fontSize: '0.75rem', fontFamily: sans, background: '#fff',
            outline: 'none', cursor: 'pointer',
          }}
        >
          <option value="all">Show all</option>
          <option value="unlinked">Unlinked only</option>
        </select>

        {/* Auto-link */}
        <button
          onClick={handleAutoLink}
          disabled={autoLinking || unlinked === 0}
          style={{
            border: 'none',
            background: autoLinking ? '#6b6b6b' : '#141414',
            color: '#ffffff',
            padding: '6px 16px',
            fontSize: '0.75rem',
            fontFamily: sans,
            cursor: autoLinking || unlinked === 0 ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
            opacity: unlinked === 0 ? 0.5 : 1,
          }}
        >
          {autoLinking ? 'Auto-linking...' : 'Auto-link all'}
        </button>

        {autoResult && (
          <span className="text-xs" style={{ color: '#6b6b6b', fontFamily: sans }}>{autoResult}</span>
        )}
      </div>

      {/* Player list */}
      <div className="divide-y" style={{ border: '1px solid #e0dbd3' }}>
        {visible.length === 0 && (
          <div className="px-6 py-8 text-center text-sm" style={{ color: '#6b6b6b', fontFamily: sans }}>
            {filter === 'unlinked' ? 'All players are linked' : 'No players found'}
          </div>
        )}

        {visible.map(player => {
          const isLinked = player.api_id !== null
          const opts     = getApiOptions(player)

          return (
            <div key={player.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5" style={{ background: '#ffffff' }}>

              {/* Left: flag + name + position */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {player.team_flag && (
                  <img src={player.team_flag} alt="" className="w-5 h-3.5 object-contain flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: '#141414', fontFamily: sans }}>
                    {player.name}
                  </div>
                  <div className="text-xs" style={{ color: '#6b6b6b', fontFamily: sans }}>
                    {player.position ?? '—'}{player.team_name ? ` · ${player.team_name}` : ''}
                  </div>
                </div>
              </div>

              {/* Middle: link status */}
              <div className="flex-shrink-0 w-24 text-center">
                {isLinked ? (
                  <span className="text-xs font-semibold" style={{ color: '#16a34a', fontFamily: sans }}>Linked</span>
                ) : (
                  <span className="text-xs" style={{ color: '#9ca3af', fontFamily: sans }}>— unlinked</span>
                )}
              </div>

              {/* Right: linked info or search dropdown */}
              {isLinked ? (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-xs" style={{ color: '#6b6b6b', fontFamily: sans }}>
                    {player.api_player_name ?? `api_id: ${player.api_id}`}
                    {player.api_player_shirt != null && ` · #${player.api_player_shirt}`}
                  </div>
                  <button
                    onClick={() => handleUnlink(player.id)}
                    disabled={loading[player.id]}
                    style={{
                      border: '1px solid #e0dbd3', background: '#fff',
                      color: '#6b6b6b', padding: '3px 8px',
                      fontSize: '0.65rem', fontFamily: sans,
                      cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                    }}
                  >
                    Unlink
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <input
                    type="text"
                    value={search[player.id] ?? ''}
                    onChange={e => setSearch(prev => ({ ...prev, [player.id]: e.target.value }))}
                    placeholder="Search api player..."
                    style={{
                      border: '1px solid #e0dbd3', padding: '4px 8px',
                      fontSize: '0.75rem', fontFamily: sans,
                      outline: 'none', width: '160px',
                    }}
                  />
                  <select
                    defaultValue=""
                    onChange={e => {
                      const val = parseInt(e.target.value, 10)
                      if (!isNaN(val)) handleLink(player.id, val)
                      e.target.value = ''
                    }}
                    disabled={loading[player.id]}
                    style={{
                      border: '1px solid #e0dbd3', padding: '4px 8px',
                      fontSize: '0.75rem', fontFamily: sans,
                      outline: 'none', cursor: 'pointer', maxWidth: '200px',
                    }}
                  >
                    <option value="" disabled>Select api player...</option>
                    {opts.map(ap => (
                      <option key={ap.api_id} value={ap.api_id}>
                        {ap.name}{ap.shirt_number != null ? ` (#${ap.shirt_number})` : ''}
                      </option>
                    ))}
                  </select>
                  {statusMsg[player.id] && (
                    <span className="text-xs" style={{ color: '#dc2626', fontFamily: sans }}>
                      {statusMsg[player.id]}
                    </span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
