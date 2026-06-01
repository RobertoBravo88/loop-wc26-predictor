'use client'

import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'

// Both the picker AND the data are loaded client-side only.
// Bundling them together inside the dynamic import keeps them off the server.
const Picker = dynamic(
  async () => {
    const [{ default: EmojiPicker }, { default: emojiData }] = await Promise.all([
      import('@emoji-mart/react'),
      import('@emoji-mart/data'),
    ])
    return function BoundPicker(props: any) {
      return <EmojiPicker data={emojiData} {...props} />
    }
  },
  { ssr: false }
)

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

// ── Tooltip showing who reacted ──────────────────────────────────────────────
function ReactionTooltip({ names }: { names: string[] }) {
  if (!names.length) return null
  return (
    <div style={{
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
      zIndex: 30,
      lineHeight: 1.4,
      maxWidth: '200px',
      textAlign: 'center',
    }}>
      {names.join(', ')}
      <div style={{
        position: 'absolute',
        top: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 0, height: 0,
        borderLeft: '5px solid transparent',
        borderRight: '5px solid transparent',
        borderTop: '5px solid #141414',
      }} />
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
export default function NewsReactions({ postId, userId, initialReactions }: Props) {
  const [reactions, setReactions]       = useState<Reaction[]>(initialReactions)
  const [showPicker, setShowPicker]     = useState(false)
  const [hoveredEmoji, setHoveredEmoji] = useState<string | null>(null)
  const [saving, setSaving]             = useState<string | null>(null)
  const pickerRef                       = useRef<HTMLDivElement>(null)

  // Close picker on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false)
      }
    }
    if (showPicker) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showPicker])

  // Group by emoji in insertion order
  const grouped: Record<string, Reaction[]> = {}
  for (const r of reactions) {
    if (!grouped[r.emoji]) grouped[r.emoji] = []
    grouped[r.emoji].push(r)
  }

  const myReactions = new Set(reactions.filter(r => r.user_id === userId).map(r => r.emoji))
  const hasAny      = Object.keys(grouped).length > 0

  async function toggleReaction(emoji: string) {
    if (saving) return
    setSaving(emoji)
    const supabase = createClient()

    if (myReactions.has(emoji)) {
      await supabase.from('news_reactions')
        .delete()
        .eq('post_id', postId).eq('user_id', userId).eq('emoji', emoji)
      setReactions(prev => prev.filter(r => !(r.user_id === userId && r.emoji === emoji)))
    } else {
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

  // emoji-mart returns { native } on selection
  function handlePickerSelect(emojiObj: { native: string }) {
    toggleReaction(emojiObj.native)
  }

  return (
    <div
      className="mt-6 pt-5"
      style={{ borderTop: '1px solid #e0dbd3' }}
      onClick={e => { e.preventDefault(); e.stopPropagation() }}
    >
      <div className="flex items-center flex-wrap gap-2">

        {/* Reaction pills */}
        {Object.entries(grouped).map(([emoji, group]) => {
          const isMine    = myReactions.has(emoji)
          const names     = group.map(r => r.profiles?.display_name ?? 'Someone')
          const isHovered = hoveredEmoji === emoji

          return (
            <div key={emoji} className="relative">
              <button
                onClick={() => toggleReaction(emoji)}
                onMouseEnter={() => setHoveredEmoji(emoji)}
                onMouseLeave={() => setHoveredEmoji(null)}
                disabled={!!saving}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  padding: '4px 12px',
                  border: `1px solid ${isMine ? '#ff5c35' : '#e0dbd3'}`,
                  background: isMine ? 'rgba(255,92,53,0.07)' : '#ffffff',
                  borderRadius: '999px',
                  cursor: saving ? 'wait' : 'pointer',
                  fontFamily: 'Inter, sans-serif',
                  transition: 'all 0.1s',
                  opacity: saving === emoji ? 0.6 : 1,
                }}
              >
                <span style={{ fontSize: '1rem', lineHeight: 1 }}>{emoji}</span>
                <span style={{ color: isMine ? '#ff5c35' : '#6b6b6b', fontWeight: 600, fontSize: '0.75rem' }}>
                  {group.length}
                </span>
              </button>
              {isHovered && <ReactionTooltip names={names} />}
            </div>
          )
        })}

        {/* Add reaction button */}
        <div className="relative" ref={pickerRef}>
          <button
            onClick={() => setShowPicker(v => !v)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              padding: '4px 12px',
              border: '1px solid #e0dbd3',
              background: showPicker ? '#f7f4ef' : '#ffffff',
              borderRadius: '999px',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontFamily: 'Inter, sans-serif',
              color: '#6b6b6b',
            }}
          >
            <span style={{ fontSize: '1rem' }}>😊</span>
            <span>{hasAny ? '+' : 'React'}</span>
          </button>

          {/* Full emoji picker — lazy loaded, appears above the button */}
          {showPicker && (
            <div style={{
              position: 'absolute',
              bottom: 'calc(100% + 6px)',
              left: 0,
              zIndex: 30,
              boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
            }}>
              <Picker
                onEmojiSelect={handlePickerSelect}
                theme="light"
                previewPosition="none"
                skinTonePosition="none"
                navPosition="bottom"
                perLine={9}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
