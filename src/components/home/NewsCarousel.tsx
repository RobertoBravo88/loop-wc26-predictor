'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import NewsReactions from '@/components/news/NewsReactions'

interface Post {
  id: string
  title: string
  slug: string
  excerpt: string | null
  image_url: string | null
  published_at: string | null
  author?: { display_name: string } | null
}

const serif = "'Playfair Display', Georgia, serif"
const sans  = 'Inter, sans-serif'

// Desktop card height — on mobile the card grows to fit image + text stacked
const CARD_HEIGHT = 260

export default function NewsCarousel({ posts, reactionsByPost = {}, userId = null }: {
  posts: Post[]
  reactionsByPost?: Record<string, any[]>
  userId?: string | null
}) {
  const [idx, setIdx] = useState(0)
  const total = posts.length

  const next = useCallback(() => setIdx(i => (i < total - 1 ? i + 1 : 0)), [total])
  const prev = useCallback(() => setIdx(i => (i > 0 ? i - 1 : total - 1)), [total])

  // Auto-advance every 5 seconds; resets whenever user navigates manually
  useEffect(() => {
    if (total <= 1) return
    const timer = setInterval(next, 5000)
    return () => clearInterval(timer)
  }, [idx, next, total])

  if (!posts.length) return null

  const post = posts[idx]

  return (
    <div style={{ border: '1px solid #e0dbd3', position: 'relative' }}>
      {/* Card — fixed height so switching posts never jumps */}
      <Link
        href={`/news/${post.slug}`}
        className="flex flex-col sm:flex-row group transition-opacity hover:opacity-90"
        style={{ background: '#ffffff', textDecoration: 'none', display: 'flex' }}
      >
        {/* Image */}
        <div className="sm:w-1/2 flex-shrink-0" style={{ height: `${CARD_HEIGHT}px`, overflow: 'hidden' }}>
          {post.image_url ? (
            <img
              src={post.image_url}
              alt={post.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', background: '#f7f4ef' }} />
          )}
        </div>

        {/* Text */}
        <div className="flex flex-col justify-center p-6 sm:p-8 flex-1 min-w-0">

          {/* Date */}
          <span
            className="text-xs uppercase tracking-widest mb-2"
            style={{ color: '#ff5c35', fontFamily: sans }}
          >
            {post.published_at ? format(new Date(post.published_at), 'd MMM yyyy') : 'Latest'}
          </span>

          {/* Reactions — stopPropagation handled inside NewsReactions, key resets state per post */}
          {userId && (
            <div className="mb-3" onClick={e => { e.preventDefault(); e.stopPropagation() }}>
              <NewsReactions
                key={post.id}
                postId={post.id}
                userId={userId}
                initialReactions={reactionsByPost[post.id] ?? []}
                compact
              />
            </div>
          )}

          <h3
            className="text-2xl sm:text-3xl leading-tight mb-3 line-clamp-3"
            style={{ fontFamily: serif, fontWeight: 700, color: '#141414' }}
          >
            {post.title}
          </h3>
          {post.excerpt && (
            <p
              className="text-sm line-clamp-2"
              style={{ color: '#6b6b6b', fontFamily: sans }}
            >
              {post.excerpt}
            </p>
          )}
        </div>
      </Link>

      {/* Navigation */}
      {total > 1 && (
        <div
          className="flex items-center justify-between px-4 py-2"
          style={{ borderTop: '1px solid #e0dbd3', background: '#faf9f7' }}
        >
          <button
            onClick={prev}
            className="flex items-center gap-1 text-xs uppercase tracking-wider transition-opacity hover:opacity-60"
            style={{ color: '#141414', fontFamily: sans, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Prev
          </button>

          {/* Dot indicators */}
          <div className="flex items-center gap-1.5">
            {posts.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                style={{
                  width: i === idx ? '1.25rem' : '0.4rem',
                  height: '0.4rem',
                  borderRadius: '9999px',
                  background: i === idx ? '#141414' : '#e0dbd3',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'all 0.2s',
                }}
              />
            ))}
          </div>

          <button
            onClick={next}
            className="flex items-center gap-1 text-xs uppercase tracking-wider transition-opacity hover:opacity-60"
            style={{ color: '#141414', fontFamily: sans, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            Next <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
