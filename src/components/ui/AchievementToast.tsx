'use client'

import { useEffect, useState } from 'react'
import { BADGE_MAP } from '@/lib/badges/definitions'

const SEEN_BADGES_KEY = 'seen_badges'

function getSeenBadges(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(SEEN_BADGES_KEY)
    if (!raw) return new Set()
    // Stored as "userId:badgeId" pairs to avoid cross-user collisions
    return new Set(JSON.parse(raw) as string[])
  } catch {
    return new Set()
  }
}

function markBadgeSeen(key: string) {
  try {
    const seen = getSeenBadges()
    seen.add(key)
    localStorage.setItem(SEEN_BADGES_KEY, JSON.stringify([...seen]))
  } catch {
    // ignore
  }
}

interface RecentBadge {
  badge_id: string
  earned_at: string
  user_id: string
}

interface Props {
  recentBadges: RecentBadge[]
}

export default function AchievementToast({ recentBadges }: Props) {
  const [queue, setQueue] = useState<RecentBadge[]>([])
  const [current, setCurrent] = useState<RecentBadge | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (recentBadges.length === 0) return
    const seen = getSeenBadges()
    const unseen = recentBadges.filter(b => {
      const key = `${b.user_id}:${b.badge_id}`
      return !seen.has(key)
    })
    if (unseen.length > 0) {
      setQueue(unseen)
    }
  }, [recentBadges])

  useEffect(() => {
    if (queue.length === 0 || current) return
    const next = queue[0]
    setCurrent(next)
    setVisible(true)
    const key = `${next.user_id}:${next.badge_id}`
    markBadgeSeen(key)

    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(() => {
        setCurrent(null)
        setQueue(prev => prev.slice(1))
      }, 300)
    }, 5000)
    return () => clearTimeout(timer)
  }, [queue, current])

  if (!current) return null

  const def = BADGE_MAP[current.badge_id]
  if (!def) return null

  function dismiss() {
    setVisible(false)
    setTimeout(() => {
      setCurrent(null)
      setQueue(prev => prev.slice(1))
    }, 300)
  }

  return (
    <div
      className="fixed bottom-6 right-6 z-50 transition-all duration-300"
      style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(16px)' }}
    >
      <button
        onClick={dismiss}
        className="flex items-center gap-3 px-4 py-3 shadow-lg text-left"
        style={{
          background: '#141414',
          border: '2px solid #ff5c35',
          fontFamily: 'Inter, sans-serif',
          cursor: 'pointer',
          minWidth: '220px',
        }}
      >
        <span className="text-2xl">{def.emoji}</span>
        <div>
          <div className="text-xs font-bold uppercase tracking-wider" style={{ color: '#ff5c35' }}>
            Badge unlocked!
          </div>
          <div className="text-sm font-semibold" style={{ color: '#ffffff' }}>
            {def.name}
          </div>
          <div className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
            {def.desc}
          </div>
        </div>
      </button>
    </div>
  )
}
