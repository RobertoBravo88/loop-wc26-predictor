import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { ArrowLeft } from 'lucide-react'
import NewsReactions from '@/components/news/NewsReactions'

export const revalidate = 60

const serif = "'Playfair Display', Georgia, serif"
const sans  = 'Inter, sans-serif'

export default async function NewsArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: post } = await supabase
    .from('news_posts')
    .select('*, author:profiles(display_name)')
    .eq('slug', slug)
    .eq('is_published', true)
    .single()

  if (!post) notFound()

  const { data: reactions } = await supabase
    .from('news_reactions')
    .select('id, emoji, user_id, profiles(display_name)')
    .eq('post_id', post.id)

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">

      {/* Back link */}
      <Link
        href="/news"
        className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider mb-6 transition-opacity hover:opacity-70"
        style={{ color: '#6b6b6b', fontFamily: sans, textDecoration: 'none' }}
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to news
      </Link>

      {/* Hero image */}
      {post.image_url && (
        <img
          src={post.image_url}
          alt={post.title}
          className="w-full object-cover mb-6"
          style={{ height: '260px' }}
        />
      )}

      {/* Meta */}
      <div
        className="flex items-center gap-2 mb-4 text-xs uppercase tracking-wider"
        style={{ color: '#6b6b6b', fontFamily: sans }}
      >
        <span>{(post.author as any)?.display_name ?? 'Loop'}</span>
        <span style={{ color: '#e0dbd3' }}>·</span>
        <span>{post.published_at ? format(new Date(post.published_at), 'd MMMM yyyy') : ''}</span>
      </div>

      {/* Title */}
      <h1
        className="text-3xl mb-6"
        style={{ fontFamily: serif, fontWeight: 900, color: '#141414', lineHeight: 1.2 }}
      >
        {post.title}
      </h1>

      {/* Divider */}
      <div style={{ borderTop: '2px solid #141414', marginBottom: '1.5rem' }} />

      {/* Body */}
      <style>{`
        .article-body p          { margin: 0 0 1.1em 0; line-height: 1.75; color: #3a3a3a; }
        .article-body p:last-child { margin-bottom: 0; }
        .article-body strong     { font-weight: 700; color: #141414; }
        .article-body em         { font-style: italic; }
        .article-body a          { color: #ff5c35; text-decoration: underline; }
        .article-body a:hover    { color: #e04a26; }
        .article-body img {
          display: block;
          max-width: 100%;
          height: auto;
          margin: 1.5rem 0;
        }
      `}</style>
      <div
        className="article-body text-sm leading-relaxed"
        style={{ fontFamily: sans }}
        dangerouslySetInnerHTML={{ __html: post.body }}
      />

      {/* Reactions */}
      {user && (
        <NewsReactions
          postId={post.id}
          userId={user.id}
          initialReactions={(reactions ?? []) as any}
        />
      )}
    </div>
  )
}
