'use client'

import Link from 'next/link'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'

type SortOption = 'points' | 'name' | 'joined-newest' | 'joined-oldest'

const sans = 'Inter, sans-serif'

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'points',       label: 'Points'       },
  { value: 'name',         label: 'Name A–Z'     },
  { value: 'joined-newest', label: 'Joined ↓'   },
  { value: 'joined-oldest', label: 'Joined ↑'   },
]

export default function AdminUserTable({ users: initial }: { users: (Profile & { favourite_team?: { name: string; flag_url: string } })[] }) {
  const [users, setUsers]     = useState(initial)
  const [sort, setSort]       = useState<SortOption>('points')
  const [promoting, setPromoting] = useState<string | null>(null)
  const [deleting, setDeleting]   = useState<string | null>(null)

  const sortedUsers = [...users].sort((a, b) => {
    if (sort === 'points')        return (b.total_points ?? 0) - (a.total_points ?? 0)
    if (sort === 'name')          return a.display_name.localeCompare(b.display_name)
    if (sort === 'joined-newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    if (sort === 'joined-oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    return 0
  })

  async function toggleAdmin(userId: string, currentRole: string) {
    setPromoting(userId)
    try {
      const res = await fetch('/api/admin/toggle-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, currentRole }),
      })
      const data = await res.json()
      if (data.error) { alert('Error: ' + data.error); return }
      window.location.reload()
    } catch (e: any) {
      alert('Failed: ' + e.message)
    } finally {
      setPromoting(null)
    }
  }

  async function handleDelete(userId: string, name: string) {
    if (!confirm(`Permanently delete looper "${name}"?\n\nThis will remove all their predictions, picks, and account. This cannot be undone.`)) return
    setDeleting(userId)
    try {
      const res  = await fetch(`/api/admin/delete-user?id=${userId}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.error) { alert('Error: ' + data.error); return }
      setUsers(prev => prev.filter(u => u.id !== userId))
    } catch (e: any) {
      alert('Delete failed: ' + e.message)
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="overflow-x-auto">

      {/* Sort bar */}
      <div className="flex items-center gap-3 px-6 py-3" style={{ borderBottom: '1px solid #e0dbd3', background: '#faf9f6' }}>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b6b6b', fontFamily: sans }}>
          Sort:
        </span>
        <div className="flex" style={{ border: '1px solid #e0dbd3', background: '#ffffff' }}>
          {SORT_OPTIONS.map((opt, i) => (
            <button
              key={opt.value}
              onClick={() => setSort(opt.value)}
              style={{
                padding: '4px 12px',
                fontSize: '0.7rem',
                fontWeight: 600,
                fontFamily: sans,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                border: 'none',
                borderLeft: i > 0 ? '1px solid #e0dbd3' : 'none',
                cursor: 'pointer',
                background: sort === opt.value ? '#141414' : 'transparent',
                color: sort === opt.value ? '#ffffff' : '#6b6b6b',
                transition: 'all 0.15s',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <span className="text-xs" style={{ color: '#b0a99f', fontFamily: sans }}>
          {sortedUsers.length} looper{sortedUsers.length !== 1 ? 's' : ''}
        </span>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-400 border-b border-gray-100 bg-gray-50">
            <th className="text-left px-6 py-2.5 font-medium">Looper</th>
            <th className="px-4 py-2.5 font-medium">Points</th>
            <th className="px-4 py-2.5 font-medium">Role</th>
            <th className="px-4 py-2.5 font-medium">Joined</th>
            <th className="px-6 py-2.5 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {sortedUsers.map(user => (
            <tr key={user.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-6 py-3">
                <div className="flex items-center gap-2">
                  {user.favourite_team?.flag_url && (
                    <img src={user.favourite_team.flag_url} alt="" className="w-5 h-3.5 object-contain rounded-sm" />
                  )}
                  <Link href={`/profile/${user.id}`} className="font-medium text-gray-800 hover:text-[#ff5c35]">
                    {user.display_name}
                  </Link>
                  {user.current_streak >= 3 && <span className="text-xs">🔥{user.current_streak}</span>}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">{user.email}</div>
              </td>
              <td className="px-4 py-3 text-center font-bold text-[#ff5c35]">{user.total_points}</td>
              <td className="px-4 py-3 text-center">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${user.role === 'admin' ? 'bg-[#ff5c35]/10 text-[#ff5c35]' : 'bg-gray-100 text-gray-500'}`}>
                  {user.role}
                </span>
              </td>
              <td className="px-4 py-3 text-center text-gray-400 text-xs">
                {new Date(user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </td>
              <td className="px-6 py-3 text-right">
                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={() => toggleAdmin(user.id, user.role)}
                    disabled={promoting === user.id}
                    className="text-xs text-gray-500 hover:text-[#ff5c35] transition-colors disabled:opacity-40"
                  >
                    {user.role === 'admin' ? 'Remove admin' : 'Make admin'}
                  </button>
                  <button
                    onClick={() => handleDelete(user.id, user.display_name)}
                    disabled={deleting === user.id}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors disabled:opacity-40"
                    title="Delete looper"
                  >
                    {deleting === user.id ? '…' : 'Delete'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
