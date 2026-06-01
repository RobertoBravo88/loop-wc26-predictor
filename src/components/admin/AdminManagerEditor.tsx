'use client'
import { useState } from 'react'

interface TeamRow {
  id: string
  name: string
  flag_url: string | null
  group_letter: string | null
  manager: string | null
}

const sans = 'Inter, sans-serif'

export default function AdminManagerEditor({ teams }: { teams: TeamRow[] }) {
  const [values, setValues]   = useState<Record<string, string>>(
    Object.fromEntries(teams.map(t => [t.id, t.manager ?? '']))
  )
  const [saving, setSaving]   = useState<Record<string, boolean>>({})
  const [saved, setSaved]     = useState<Record<string, boolean>>({})

  async function handleSave(teamId: string) {
    setSaving(prev => ({ ...prev, [teamId]: true }))
    try {
      await fetch('/api/admin/update-team', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, manager: values[teamId] }),
      })
      setSaved(prev => ({ ...prev, [teamId]: true }))
      setTimeout(() => setSaved(prev => ({ ...prev, [teamId]: false })), 2000)
    } finally {
      setSaving(prev => ({ ...prev, [teamId]: false }))
    }
  }

  // Group teams by group letter
  const groups = [...new Set(teams.map(t => t.group_letter).filter(Boolean) as string[])].sort()

  return (
    <div className="p-5">
      <p className="text-xs mb-4" style={{ color: '#6b6b6b', fontFamily: sans }}>
        Type a manager name and press Save or hit Enter.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {groups.map(g => (
          <div key={g} style={{ border: '1px solid #e0dbd3' }}>
            <div
              className="px-4 py-2 text-xs font-bold uppercase tracking-wider"
              style={{ background: '#141414', color: '#ffffff', fontFamily: sans }}
            >
              Group {g}
            </div>
            {teams.filter(t => t.group_letter === g).map(team => (
              <div
                key={team.id}
                className="flex items-center gap-3 px-3 py-2.5"
                style={{ borderBottom: '1px solid #e0dbd3', background: '#ffffff' }}
              >
                {team.flag_url && (
                  <img src={team.flag_url} alt="" className="w-5 h-3.5 object-contain flex-shrink-0" />
                )}
                <span className="text-xs font-medium w-24 truncate flex-shrink-0" style={{ color: '#141414', fontFamily: sans }}>
                  {team.name}
                </span>
                <input
                  type="text"
                  value={values[team.id] ?? ''}
                  onChange={e => setValues(prev => ({ ...prev, [team.id]: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleSave(team.id)}
                  placeholder="Coach name…"
                  style={{
                    flex: 1, minWidth: 0,
                    border: '1px solid #e0dbd3',
                    padding: '4px 8px',
                    fontSize: '0.7rem',
                    fontFamily: sans,
                    outline: 'none',
                    color: '#141414',
                  }}
                />
                <button
                  onClick={() => handleSave(team.id)}
                  disabled={saving[team.id]}
                  style={{
                    border: 'none',
                    background: saved[team.id] ? '#22c55e' : '#ff5c35',
                    color: '#fff',
                    padding: '4px 8px',
                    fontSize: '0.7rem',
                    fontFamily: sans,
                    cursor: saving[team.id] ? 'not-allowed' : 'pointer',
                    flexShrink: 0,
                    transition: 'background 0.2s',
                    minWidth: '42px',
                  }}
                >

                  {saved[team.id] ? '✓' : saving[team.id] ? '…' : 'Save'}
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
