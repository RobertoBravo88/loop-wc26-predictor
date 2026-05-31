'use client'

import Link from 'next/link'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'

export default function AdminUserTable({ users }: { users: (Profile & { favourite_team?: { name: string; flag_url: string } })[] }) {
  const [promoting, setPromoting] = useState<string | null>(null)

  async function toggleAdmin(userId: string, currentRole: string) {
    setPromoting(userId)
    const supabase = createClient()
    await supabase.from('profiles')
      .update({ role: currentRole === 'admin' ? 'player' : 'admin' })
      .eq('id', userId)
    setPromoting(null)
    window.location.reload()
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-400 border-b border-gray-100 bg-gray-50">
            <th className="text-left px-6 py-2.5 font-medium">Player</th>
            <th className="px-4 py-2.5 font-medium">Points</th>
            <th className="px-4 py-2.5 font-medium">Role</th>
            <th className="px-4 py-2.5 font-medium">Joined</th>
            <th className="px-6 py-2.5 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {users.map(user => (
            <tr key={user.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-6 py-3">
                <div className="flex items-center gap-2">
                  {user.favourite_team?.flag_url && (
                    <img src={user.favourite_team.flag_url} alt="" className="w-5 h-3.5 object-cover rounded-sm" />
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
                <button
                  onClick={() => toggleAdmin(user.id, user.role)}
                  disabled={promoting === user.id}
                  className="text-xs text-gray-500 hover:text-[#ff5c35] transition-colors disabled:opacity-40"
                >
                  {user.role === 'admin' ? 'Remove admin' : 'Make admin'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
