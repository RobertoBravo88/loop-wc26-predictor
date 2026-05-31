'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Search, Trash2 } from 'lucide-react'

interface Player {
  id: string
  name: string
  position: string | null
  team_id: string
  team?: { name: string; flag_url: string | null }
}

interface Props {
  players: Player[]
}

export default function AdminPlayersSection({ players: initialPlayers }: Props) {
  const [players, setPlayers] = useState<Player[]>(initialPlayers)
  const [query, setQuery] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const filtered = query.trim().length >= 2
    ? players.filter(p =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        (p.team?.name ?? '').toLowerCase().includes(query.toLowerCase())
      )
    : []

  async function handleDelete(player: Player) {
    if (!confirm(`Delete ${player.name} (${player.team?.name ?? ''})? This cannot be undone.`)) return
    setDeletingId(player.id)
    setError(null)
    const supabase = createClient()
    const { error: err } = await supabase.from('players').delete().eq('id', player.id)
    setDeletingId(null)
    if (err) {
      setError(`Could not delete ${player.name}: ${err.message}`)
    } else {
      setPlayers(prev => prev.filter(p => p.id !== player.id))
    }
  }

  return (
    <div className="p-6">
      {/* Search */}
      <div className="relative mb-4">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
          style={{ color: '#6b6b6b' }}
        />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by player or team name…"
          className="w-full pl-9 pr-4 py-2 text-sm focus:outline-none"
          style={{
            border: '1px solid #e0dbd3',
            fontFamily: 'Inter, sans-serif',
            color: '#141414',
            background: '#ffffff',
          }}
        />
      </div>

      {error && (
        <p className="text-xs mb-3" style={{ color: '#dc2626', fontFamily: 'Inter, sans-serif' }}>
          {error}
        </p>
      )}

      {/* Hint when search is short */}
      {query.trim().length > 0 && query.trim().length < 2 && (
        <p className="text-xs" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
          Type at least 2 characters to search.
        </p>
      )}

      {/* Results */}
      {filtered.length > 0 && (
        <div style={{ border: '1px solid #e0dbd3' }}>
          {filtered.slice(0, 30).map((player, i) => (
            <div
              key={player.id}
              className="flex items-center gap-3 px-4 py-2.5"
              style={{
                borderBottom: i < filtered.length - 1 ? '1px solid #e0dbd3' : 'none',
                background: i % 2 === 0 ? '#ffffff' : '#faf9f6',
              }}
            >
              {player.team?.flag_url && (
                <img
                  src={player.team.flag_url}
                  alt=""
                  className="w-5 h-3.5 object-contain flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <span
                  className="text-sm font-medium truncate block"
                  style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}
                >
                  {player.name}
                </span>
                <span
                  className="text-xs"
                  style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}
                >
                  {player.team?.name ?? '—'}{player.position ? ` · ${player.position}` : ''}
                </span>
              </div>
              <button
                onClick={() => handleDelete(player)}
                disabled={deletingId === player.id}
                className="flex items-center gap-1 text-xs uppercase tracking-wider font-medium transition-opacity hover:opacity-70 disabled:opacity-40 flex-shrink-0"
                style={{ color: '#dc2626', fontFamily: 'Inter, sans-serif', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                {deletingId === player.id
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Trash2 className="w-3.5 h-3.5" />
                }
                Delete
              </button>
            </div>
          ))}
          {filtered.length > 30 && (
            <p
              className="px-4 py-2 text-xs"
              style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif', background: '#faf9f6' }}
            >
              Showing first 30 of {filtered.length} results — refine your search.
            </p>
          )}
        </div>
      )}

      {query.trim().length >= 2 && filtered.length === 0 && (
        <p className="text-xs" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
          No players found for &ldquo;{query}&rdquo;.
        </p>
      )}
    </div>
  )
}
