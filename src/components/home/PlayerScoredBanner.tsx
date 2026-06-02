'use client'

import { useState, useEffect } from 'react'

export interface ScoredGoal {
  playerName: string
  teamFlag: string | null
  points: number
  type: 'scorer' | 'team' | 'player'
  goalEventId: string
}

interface Props {
  goals: ScoredGoal[]
}

const DISMISSED_KEY = 'dismissed_goals'

function getDismissed(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(DISMISSED_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as string[])
  } catch {
    return new Set()
  }
}

function saveDismissed(ids: Set<string>) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]))
  } catch {
    // ignore
  }
}

export default function PlayerScoredBanner({ goals }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setDismissed(getDismissed())
    setMounted(true)
  }, [])

  if (!mounted) return null

  const visible = goals.filter(g => !dismissed.has(g.goalEventId))
  if (visible.length === 0) return null

  function dismiss(id: string) {
    setDismissed(prev => {
      const next = new Set(prev)
      next.add(id)
      saveDismissed(next)
      return next
    })
  }

  function dismissAll() {
    setDismissed(prev => {
      const next = new Set(prev)
      for (const g of goals) next.add(g.goalEventId)
      saveDismissed(next)
      return next
    })
  }

  function getBannerText(g: ScoredGoal): string {
    if (g.type === 'scorer') return `👟 ${g.playerName} scored! +${g.points} pts`
    if (g.type === 'player') return `⭐ Your player scored! +${g.points} pts`
    return `🏴 Your team scored! +${g.points} pts`
  }

  return (
    <div className="space-y-2 mb-4">
      {visible.map(g => (
        <div
          key={g.goalEventId}
          className="flex items-center justify-between gap-3 px-4 py-3"
          style={{ background: '#ff5c35', fontFamily: 'Inter, sans-serif' }}
        >
          <div className="flex items-center gap-2 min-w-0">
            {g.teamFlag && (
              <img src={g.teamFlag} alt="" className="w-6 h-4 object-contain flex-shrink-0" />
            )}
            <span className="text-sm font-semibold text-white truncate">
              {getBannerText(g)}
            </span>
          </div>
          <button
            onClick={() => dismiss(g.goalEventId)}
            className="flex-shrink-0 text-white text-base leading-none hover:opacity-70 transition-opacity"
            aria-label="Dismiss"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}
          >
            ×
          </button>
        </div>
      ))}
      {visible.length > 1 && (
        <div className="text-right">
          <button
            onClick={dismissAll}
            className="text-xs underline hover:opacity-70 transition-opacity"
            style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Dismiss all
          </button>
        </div>
      )}
    </div>
  )
}
