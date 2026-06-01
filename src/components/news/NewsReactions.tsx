'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

// Standard emoji set — football-flavoured + common reactions
const EMOJI_SET = ['⚽', '🔥', '👍', '❤️', '😂', '😮', '👏', '🙌']

interface Reaction {
  id: string
  emoji: string
  user_id: string
  profiles: { display_name: string } | null
}

interface Props {
  postId: string
  userId: string
  initialReactions: Reaction[]
}

// ── Tooltip that lists who reacted with a given emoji ────────────────────────
function ReactionTooltip({ names }: { names: string[] }) {
  if (!names.length) return null
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 'calc(100% + 6px)',
        left: '50%',
        transform: 'translateX(-50%)',
        background: '#141414',
        color: '#ffffff',
        fontSize: '0.7rem',
        fontFamily: 'Inter, sans-serif',
        padding: '6px 10px',
        whiteSpace: 'normal',
        pointerEvents: 'none',
        zIndex: 20,
        lineHeight: 1.4,
        maxWidth: '200px',
        textAlign: 'center',
      }}
    >
      {names.join(', ')}
      {/* Arrow */}
      <div style={{
        position: 'absolute',
        top: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 0,
        height: 0,
        borderLeft: '5px solid transparent',
        borderRight: '5px solid transparent',
        borderTop: '5px solid #141414',
      }} />
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
export default function NewsReactions({ postId, userId, initialReactions }: Props) {
  const [reactions, setReactions]     = useState<Reaction[]>(initialReactions)
  const [showPicker, setShowPicker]   = useState(false)
  const [hoveredEmoji, setHoveredEmoji] = useState<string | null>(null)
  const [saving, setSaving]           = useState<string | null>(null)
  const pickerRef                     = useRef<HTMLDivElement>(null)

  // Close picker when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false)
      }
    }
    if (showPicker) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showPicker])

  // Group reactions by emoji, preserving EMOJI_SET order
  const grouped: Record<string, Reaction[]> = {}
  for (const emoji of EMOJI_SET) {
    const group = reactions.filter(r => r.emoji === emoji)
    if (group.length > 0) grouped[emoji] = group
  }
  // Also show any emoji outside the standard set
  for (const r of reactions) {
    if (!grouped[r.emoji]) grouped[r.emoji] = reactions.filter(rr => rr.emoji === r.emoji)
  }

  const myReactions = new Set(reactions.filter(r => r.user_id === userId).map(r => r.emoji))

  async function toggleReaction(emoji: string) {
    if (saving) return
    setSaving(emoji)
    const supabase = createClient()

    if (myReactions.has(emoji)) {
      // Remove
      await supabase.from('news_reactions')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', userId)
        .eq('emoji', emoji)
      setReactions(prev => prev.filter(r => !(r.user_id === userId && r.emoji === emoji)))
    } else {
      // Add
      const { data } = await supabase
        .from('news_reactions')
        .insert({ post_id: postId, user_id: userId, emoji })
        .select('*, profiles(display_name)')
        .single()
      if (data) setReactions(prev => [...prev, data as Reaction])
    }

    setSaving(null)
    setShowPicker(false)
  }

  const hasAny = Object.keys(grouped).length > 0

  return (
    <div className="mt-6 pt-5" style={{ borderTop: '1px solid #e0dbd3' }}>
      <div className="flex items-center flex-wrap gap-2">

        {/* Existing reaction pills */}
        {Object.entries(grouped).map(([emoji, group]) => {
          const isMine   = myReactions.has(emoji)
          const names    = group.map(r => r.profiles?.display_name ?? 'Someone')
          const isHovered = hoveredEmoji === emoji

          return (
            <div key={emoji} className="relative">
              <button
                onClick={() => toggleReaction(emoji)}
                onMouseEnter={() => setHoveredEmoji(emoji)}
                onMouseLeave={() => setHoveredEmoji(null)}
                disabled={saving === emoji}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '4px 12px',
                  border: `1px solid ${isMine ? '#ff5c35' : '#e0dbd3'}`,
                  background: isMine ? 'rgba(255,92,53,0.07)' : '#ffffff',
                  borderRadius: '999px',
                  cursor: saving === emoji ? 'wait' : 'pointer',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '0.8rem',
                  transition: 'all 0.1s',
                  opacity: saving === emoji ? 0.6 : 1,
                }}
              >
                <span style={{ fontSize: '1rem', lineHeight: 1 }}>{emoji}</span>
                <span style={{
                  color: isMine ? '#ff5c35' : '#6b6b6b',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                }}>
                  {group.length}
                </span>
              </button>

              {/* Hover tooltip — who reacted */}
              {isHovered && <ReactionTooltip names={names} />}
            </div>
          )
        })}

        {/* Add reaction button + picker */}
        <div className="relative" ref={pickerRef}>
          <button
            onClick={() => setShowPicker(v => !v)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 12px',
              border: '1px solid #e0dbd3',
              background: showPicker ? '#f7f4ef' : '#ffffff',
              borderRadius: '999px',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontFamily: 'Inter, sans-serif',
              color: '#6b6b6b',
              transition: 'background 0.1s',
            }}
          >
            <span style={{ fontSize: '1rem' }}>+</span>
            {!hasAny && <span>React</span>}
          </button>

          {/* Emoji picker popup */}
          {showPicker && (
            <div
              style={{
                position: 'absolute',
                bottom: 'calc(100% + 6px)',
                left: 0,
                background: '#ffffff',
                border: '1px solid #e0dbd3',
                padding: '8px',
                display: 'flex',
                gap: '2px',
                flexWrap: 'wrap',
                zIndex: 20,
                boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                width: '200px',
              }}
            >
              {EMOJI_SET.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => toggleReaction(emoji)}
                  style={{
                    background: myReactions.has(emoji) ? '#fff8f0' : 'transparent',
                    border: myReactions.has(emoji) ? '1px solid #ff5c35' : '1px solid transparent',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '1.4rem',
                    padding: '6px',
                    lineHeight: 1,
                    transition: 'background 0.1s',
                    width: '44px',
                    height: '44px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title={emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
