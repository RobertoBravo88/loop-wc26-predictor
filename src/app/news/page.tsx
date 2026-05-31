import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { format } from 'date-fns'

export const revalidate = 300

export default async function NewsPage() {
  const supabase = await createClient()

  const { data: posts } = await supabase
    .from('news_posts')
    .select('*, author:profiles(display_name)')
    .eq('is_published', true)
    .order('published_at', { ascending: false })

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">News</h1>
      <div className="space-y-5">
        {(posts ?? []).map((post: any) => (
          <Link key={post.id} href={`/news/${post.slug}`}
            className="block bg-white rounded-2xl border border-gray-100 overflow-hidden hover:border-[#ff5c35]/30 hover:shadow-sm transition-all group">
            {post.image_url && (
              <img src={post.image_url} alt={post.title} className="w-full h-48 object-cover" />
            )}
            <div className="p-5">
              <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                <span>{post.author?.display_name ?? 'Loop'}</span>
                <span>·</span>
                <span>{post.published_at ? format(new Date(post.published_at), 'dd MMM yyyy') : ''}</span>
              </div>
              <h2 className="font-bold text-gray-900 group-hover:text-[#ff5c35] transition-colors mb-1">{post.title}</h2>
              {post.excerpt && <p className="text-sm text-gray-500 line-clamp-2">{post.excerpt}</p>}
            </div>
          </Link>
        ))}
        {!posts?.length && (
          <div className="text-center py-16 text-gray-400 text-sm">No posts yet. Check back soon!</div>
        )}
      </div>
    </div>
  )
}
