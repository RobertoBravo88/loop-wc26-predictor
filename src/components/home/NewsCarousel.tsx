'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'

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

export default function NewsCarousel({ posts }: { posts: Post[] }) {
  const [idx, setIdx] = useState(0)

  if (!posts.length) return null

  const post    = posts[idx]
  const total   = posts.length
  const hasPrev = total > 1
  const hasNext = total > 1

  function prev() { setIdx(i => (i > 0 ? i - 1 : total - 1)) }
  function next() { setIdx(i => (i < total - 1 ? i + 1 : 0)) }

  return (
    <div style={{ border: '1px solid #e0dbd3', position: 'relative' }}>
      {/* Card */}
      <Link
        href={`/news/${post.slug}`}
        className="flex flex-col sm:flex-row group transition-opacity hover:opacity-90"
        style={{ background: '#ffffff', textDecoration: 'none', display: 'flex', minHeight: '200px' }}
      >
        {/* Image */}
        {post.image_url ? (
          <div className="sm:w-1/2 flex-shrink-0">
            <img
              src={post.image_url}
              alt={post.title}
              className="w-full h-48 sm:h-full object-cover"
              style={{ minHeight: '200px' }}
            />
          </div>
        ) : (
          <div
            className="sm:w-1/2 flex-shrink-0 h-48"
            style={{ background: '#f7f4ef', minHeight: '200px' }}
          />
        )}

        {/* Text */}
        <div className="flex flex-col justify-center p-6 sm:p-8 flex-1">
          <span
            className="text-xs uppercase tracking-widest mb-3"
            style={{ color: '#ff5c35', fontFamily: sans }}
          >
            {post.published_at ? format(new Date(post.published_at), 'd MMM yyyy') : 'Latest'}
          </span>
          <h3
            className="text-2xl sm:text-3xl leading-tight mb-3"
            style={{ fontFamily: serif, fontWeight: 700, color: '#141414' }}
          >
            {post.title}
          </h3>
          {post.excerpt && (
            <p
              className="text-sm line-clamp-3"
              style={{ color: '#6b6b6b', fontFamily: sans }}
            >
              {post.excerpt}
            </p>
          )}
        </div>
      </Link>

      {/* Navigation — only shown when there are multiple posts */}
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
