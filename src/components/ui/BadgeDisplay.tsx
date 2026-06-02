'use client'

import { BADGE_MAP, RARITY_ORDER } from '@/lib/badges/definitions'

interface UserBadge {
  badge_id: string
  earned_at: string
}

interface Props {
  badges: UserBadge[]
  userFlagUrl?: string | null
  max?: number
  size?: 'sm' | 'md'
}

export default function BadgeDisplay({ badges, userFlagUrl, max, size = 'md' }: Props) {
  if (!badges || badges.length === 0) return null

  // Sort by rarity (very_rare first), then by earned_at desc
  const sorted = [...badges].sort((a, b) => {
    const aDef = BADGE_MAP[a.badge_id]
    const bDef = BADGE_MAP[b.badge_id]
    const aOrder = aDef ? RARITY_ORDER[aDef.rarity] : 99
    const bOrder = bDef ? RARITY_ORDER[bDef.rarity] : 99
    if (aOrder !== bOrder) return aOrder - bOrder
    return new Date(b.earned_at).getTime() - new Date(a.earned_at).getTime()
  })

  const visible = max ? sorted.slice(0, max) : sorted
  const overflow = max ? Math.max(0, sorted.length - max) : 0

  const emojiSize = size === 'sm' ? 'text-sm' : 'text-base'
  const pillSize  = size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2 py-1'

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {visible.map(b => {
        const def = BADGE_MAP[b.badge_id]
        if (!def) return null
        const isTwelfthMan = b.badge_id === 'twelfth_man'
        return (
          <div
            key={b.badge_id}
            title={`${def.name} — ${def.desc}`}
            className={`flex items-center justify-center ${emojiSize}`}
            style={{ cursor: 'default' }}
          >
            {isTwelfthMan && userFlagUrl ? (
              <img
                src={userFlagUrl}
                alt={def.name}
                className="w-5 h-3.5 object-contain"
                title={`${def.name} — ${def.desc}`}
              />
            ) : (
              <span>{def.emoji}</span>
            )}
          </div>
        )
      })}
      {overflow > 0 && (
        <span
          className={`${pillSize} font-semibold`}
          style={{ background: '#e0dbd3', color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}
        >
          +{overflow}
        </span>
      )}
    </div>
  )
}
