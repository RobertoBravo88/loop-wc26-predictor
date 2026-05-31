import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { format } from 'date-fns'

export const revalidate = 300

const serif = "'Playfair Display', Georgia, serif"
const sans  = 'Inter, sans-serif'

export default async function NewsPage() {
  const supabase = await createClient()

  const { data: posts } = await supabase
    .from('news_posts')
    .select('*, author:profiles(display_name)')
    .eq('is_published', true)
    .order('published_at', { ascending: false })

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">

      {/* Page header */}
      <div className="mb-8 pb-3" style={{ borderBottom: '2px solid #141414' }}>
        <h1
          className="text-4xl"
          style={{ fontFamily: serif, fontWeight: 900, color: '#141414' }}
        >
          News
        </h1>
      </div>

      {/* Post list */}
      <div style={{ border: '1px solid #e0dbd3' }}>
        {(posts ?? []).map((post: any, i: number) => (
          <Link
            key={post.id}
            href={`/news/${post.slug}`}
            className="block transition-colors hover:opacity-80"
            style={{
              borderBottom: i < (posts?.length ?? 0) - 1 ? '1px solid #e0dbd3' : 'none',
              textDecoration: 'none',
            }}
          >
            {post.image_url && (
              <img
                src={post.image_url}
                alt={post.title}
                className="w-full object-cover"
                style={{ height: '220px' }}
              />
            )}
            <div className="px-5 py-4" style={{ background: '#ffffff' }}>
              <div
                className="flex items-center gap-2 mb-2 text-xs uppercase tracking-wider"
                style={{ color: '#6b6b6b', fontFamily: sans }}
              >
                <span>{(post.author as any)?.display_name ?? 'Loop'}</span>
                <span style={{ color: '#e0dbd3' }}>·</span>
                <span>{post.published_at ? format(new Date(post.published_at), 'd MMM yyyy') : ''}</span>
              </div>
              <h2
                className="text-lg mb-1"
                style={{ fontFamily: serif, fontWeight: 700, color: '#141414', lineHeight: 1.3 }}
              >
                {post.title}
              </h2>
              {post.excerpt && (
                <p
                  className="text-sm line-clamp-2"
                  style={{ color: '#6b6b6b', fontFamily: sans, lineHeight: 1.6 }}
                >
                  {post.excerpt}
                </p>
              )}
              <span
                className="inline-block mt-3 text-xs font-semibold uppercase tracking-wider"
                style={{ color: '#ff5c35', fontFamily: sans }}
              >
                Read more →
              </span>
            </div>
          </Link>
        ))}

        {!posts?.length && (
          <div
            className="px-5 py-16 text-center text-sm"
            style={{ color: '#6b6b6b', fontFamily: sans, background: '#ffffff' }}
          >
            No posts yet — check back soon.
          </div>
        )}
      </div>
    </div>
  )
}
