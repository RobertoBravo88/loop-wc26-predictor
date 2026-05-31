import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { ArrowLeft } from 'lucide-react'

export const revalidate = 300

export default async function NewsArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: post } = await supabase
    .from('news_posts')
    .select('*, author:profiles(display_name)')
    .eq('slug', slug)
    .eq('is_published', true)
    .single()

  if (!post) notFound()

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <Link href="/news" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to news
      </Link>

      {post.image_url && (
        <img src={post.image_url} alt={post.title} className="w-full h-64 object-cover rounded-2xl mb-6" />
      )}

      <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
        <span>{(post.author as any)?.display_name ?? 'Loop'}</span>
        <span>·</span>
        <span>{post.published_at ? format(new Date(post.published_at), 'dd MMMM yyyy') : ''}</span>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 mb-6">{post.title}</h1>

      <style>{`
        .article-body p        { margin: 0 0 1em 0; line-height: 1.75; }
        .article-body p:last-child { margin-bottom: 0; }
        .article-body strong   { font-weight: 700; color: #141414; }
        .article-body em       { font-style: italic; }
        .article-body a        { color: #ff5c35; text-decoration: underline; }
        .article-body a:hover  { color: #e04a26; }
        .article-body img {
          display: block;
          max-width: 100%;
          height: auto;
          margin: 1.5rem 0;
        }
      `}</style>
      <div
        className="article-body text-sm leading-relaxed"
        style={{ color: '#3a3a3a', fontFamily: 'Inter, sans-serif' }}
        dangerouslySetInnerHTML={{ __html: post.body }}
      />
    </div>
  )
}
