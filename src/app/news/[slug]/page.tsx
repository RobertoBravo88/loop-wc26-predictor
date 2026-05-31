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

      <div className="prose prose-gray max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
        {post.body}
      </div>
    </div>
  )
}
