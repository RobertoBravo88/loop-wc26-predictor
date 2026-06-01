'use client'
import { useState, useRef } from 'react'

export interface UnlinkedPlayer {
  id: string
  name: string
  position: string | null
  team: { id: string; name: string; flag_url: string | null } | null
}

interface ApiResult {
  id: number
  name: string
  nationality: string | null
  photo: string | null
}

const sans = 'Inter, sans-serif'

export default function AdminPlayerLinker({ players: initial }: { players: UnlinkedPlayer[] }) {
  const [players, setPlayers]         = useState(initial)
  const [expandedId, setExpandedId]   = useState<string | null>(null)
  const [query, setQuery]             = useState('')
  const [results, setResults]         = useState<ApiResult[]>([])
  const [searching, setSearching]     = useState(false)
  const [teamFilter, setTeamFilter]   = useState('')
  const [statusMsg, setStatusMsg]     = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const teamNames = [...new Set(players.map(p => p.team?.name).filter(Boolean) as string[])].sort()
  const visible   = teamFilter ? players.filter(p => p.team?.name === teamFilter) : players

  async function search(q: string) {
    if (q.trim().length < 3) return
    setSearching(true)
    setResults([])
    try {
      const res  = await fetch(`/api/admin/search-player?q=${encodeURIComponent(q.trim())}`)
      const data = await res.json()
      setResults(data.players ?? [])
      if ((data.players ?? []).length === 0) setStatusMsg('No results — try a last name only')
      else setStatusMsg('')
    } catch {
      setStatusMsg('Search failed')
    } finally {
      setSearching(false)
    }
  }

  function openSearch(player: UnlinkedPlayer) {
    setExpandedId(player.id)
    setQuery(player.name)
    setResults([])
    setStatusMsg('')
    setTimeout(() => {
      inputRef.current?.focus()
      search(player.name)
    }, 50)
  }

  function closeSearch() {
    setExpandedId(null)
    setResults([])
    setStatusMsg('')
  }

  async function handleLink(playerId: string, apiId: number) {
    const res  = await fetch('/api/admin/link-player', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ playerId, apiId }),
    })
    const data = await res.json()
    if (data.error) { alert(data.error); return }
    setPlayers(prev => prev.filter(p => p.id !== playerId))
    closeSearch()
  }

  async function handleDelete(playerId: string) {
    if (!confirm('Delete this player? This will fail if anyone has picked them.')) return
    const res  = await fetch(`/api/admin/delete-player?id=${playerId}`, { method: 'DELETE' })
    const data = await res.json()
    if (data.error) { alert(data.error); return }
    setPlayers(prev => prev.filter(p => p.id !== playerId))
    if (expandedId === playerId) closeSearch()
  }

  if (players.length === 0) {
    return (
      <div className="px-6 py-8 text-center text-sm" style={{ color: '#6b6b6b', fontFamily: sans }}>
        All players are linked ✓
      </div>
    )
  }

  return (
    <div className="p-5">

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <select
          value={teamFilter}
          onChange={e => { setTeamFilter(e.target.value); closeSearch() }}
          style={{
            border: '1px solid #e0dbd3', padding: '6px 10px',
            fontSize: '0.75rem', fontFamily: sans, background: '#fff',
            outline: 'none', cursor: 'pointer',
          }}
        >
          <option value="">All teams — {players.length} unlinked</option>
          {teamNames.map(t => {
            const count = players.filter(p => p.team?.name === t).length
            return <option key={t} value={t}>{t} ({count})</option>
          })}
        </select>
      </div>

      {/* Player list */}
      <div className="divide-y" style={{ border: '1px solid #e0dbd3' }}>
        {visible.map(player => (
          <div key={player.id}>

            {/* Player row */}
            <div
              className="flex items-center gap-3 px-4 py-2.5"
              style={{ background: expandedId === player.id ? '#faf9f6' : '#ffffff' }}
            >
              {player.team?.flag_url && (
                <img src={player.team.flag_url} alt="" className="w-5 h-3.5 object-contain flex-shrink-0" />
              )}
              <span
                className="w-28 text-xs truncate flex-shrink-0"
                style={{ color: '#6b6b6b', fontFamily: sans }}
              >
                {player.team?.name}
              </span>
              <span className="flex-1 text-sm font-medium truncate" style={{ color: '#141414', fontFamily: sans }}>
                {player.name}
              </span>
              <span className="w-20 text-xs flex-shrink-0" style={{ color: '#6b6b6b', fontFamily: sans }}>
                {player.position ?? '—'}
              </span>

              {/* Link button */}
              <button
                onClick={() => expandedId === player.id ? closeSearch() : openSearch(player)}
                style={{
                  border: '1px solid #141414',
                  background: expandedId === player.id ? '#141414' : '#ffffff',
                  color: expandedId === player.id ? '#ffffff' : '#141414',
                  padding: '4px 10px', fontSize: '0.7rem', fontFamily: sans,
                  cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                }}
              >
                🔗 {expandedId === player.id ? 'Cancel' : 'Link'}
              </button>

              {/* Delete button */}
              <button
                onClick={() => handleDelete(player.id)}
                style={{
                  border: '1px solid #fca5a5', background: '#fff5f5',
                  color: '#dc2626', padding: '4px 8px',
                  fontSize: '0.7rem', fontFamily: sans, cursor: 'pointer', flexShrink: 0,
                }}
              >
                ✕
              </button>
            </div>

            {/* Expanded search panel */}
            {expandedId === player.id && (
              <div className="px-4 py-3" style={{ background: '#faf9f6', borderTop: '1px solid #f0ede8' }}>

                {/* Search input */}
                <div className="flex gap-2 mb-3">
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && search(query)}
                    placeholder="Search by name on api-football…"
                    style={{
                      flex: 1, border: '1px solid #e0dbd3',
                      padding: '6px 10px', fontSize: '0.75rem',
                      fontFamily: sans, outline: 'none', background: '#fff',
                    }}
                  />
                  <button
                    onClick={() => search(query)}
                    disabled={searching}
                    style={{
                      border: '1px solid #141414', background: '#141414',
                      color: '#fff', padding: '6px 14px',
                      fontSize: '0.75rem', fontFamily: sans,
                      cursor: searching ? 'not-allowed' : 'pointer',
                      opacity: searching ? 0.6 : 1, whiteSpace: 'nowrap',
                    }}
                  >
                    {searching ? 'Searching…' : 'Search'}
                  </button>
                </div>

                {/* Status / no results */}
                {statusMsg && (
                  <p className="text-xs mb-2" style={{ color: '#6b6b6b', fontFamily: sans }}>{statusMsg}</p>
                )}

                {/* Results */}
                {results.length > 0 && (
                  <div className="space-y-1">
                    {results.map(r => (
                      <div
                        key={r.id}
                        className="flex items-center gap-3 px-3 py-2"
                        style={{ background: '#ffffff', border: '1px solid #e0dbd3' }}
                      >
                        {r.photo && (
                          <img src={r.photo} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate" style={{ color: '#141414', fontFamily: sans }}>
                            {r.name}
                          </div>
                          <div className="text-xs" style={{ color: '#6b6b6b', fontFamily: sans }}>
                            {r.nationality ?? '—'} · API id: {r.id}
                          </div>
                        </div>
                        <button
                          onClick={() => handleLink(player.id, r.id)}
                          style={{
                            border: '1px solid #ff5c35', background: '#ff5c35',
                            color: '#ffffff', padding: '5px 12px',
                            fontSize: '0.75rem', fontFamily: sans,
                            cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                          }}
                        >
                          Link ✓
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
