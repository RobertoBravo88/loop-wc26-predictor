'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import AdminNewsForm from './AdminNewsForm'

interface Post {
  id: string
  title: string
  excerpt: string | null
  body: string
  image_url: string | null
  is_published: boolean
  published_at: string | null
  slug: string
}

interface Props {
  authorId: string
  posts: Post[]
}

export default function AdminNewsSection({ authorId, posts: initialPosts }: Props) {
  const router = useRouter()
  const [posts, setPosts] = useState<Post[]>(initialPosts)
  const [mode, setMode] = useState<'idle' | 'create' | 'edit'>('idle')
  const [editingPost, setEditingPost] = useState<Post | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function openCreate() { setEditingPost(null); setMode('create') }
  function openEdit(post: Post) { setEditingPost(post); setMode('edit') }
  function closeForm() { setMode('idle'); setEditingPost(null) }

  async function handleDelete(id: string) {
    if (!confirm('Delete this post? This cannot be undone.')) return
    setDeletingId(id)
    const supabase = createClient()
    await supabase.from('news_posts').delete().eq('id', id)
    setPosts(prev => prev.filter(p => p.id !== id))
    setDeletingId(null)
    router.refresh()
  }

  function handleSaved(saved: Post) {
    if (mode === 'edit') {
      setPosts(prev => prev.map(p => p.id === saved.id ? saved : p))
    } else {
      setPosts(prev => [saved, ...prev])
    }
    closeForm()
    // Revalidate server component data in the background
    router.refresh()
  }

  return (
    <div className="p-6">
      {/* Create / Edit form */}
      {mode !== 'idle' ? (
        <AdminNewsForm
          authorId={authorId}
          post={editingPost ?? undefined}
          onClose={closeForm}
          onSaved={handleSaved}
        />
      ) : (
        <button
          onClick={openCreate}
          className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider px-4 py-2 transition-colors"
          style={{ background: '#ff5c35', color: '#ffffff', fontFamily: 'Inter, sans-serif' }}
        >
          + Write a post
        </button>
      )}

      {/* Post list */}
      {posts.length > 0 && (
        <div className="mt-6 space-y-0" style={{ borderTop: '1px solid #e0dbd3' }}>
          {posts.map(post => (
            <div
              key={post.id}
              className="flex items-center gap-3 py-2.5 text-sm"
              style={{ borderBottom: '1px solid #e0dbd3' }}
            >
              {/* Published indicator */}
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: post.is_published ? '#22c55e' : '#d4cfc8' }}
              />

              {/* Title */}
              <span
                className="flex-1 font-medium truncate"
                style={{ color: '#141414', fontFamily: 'Inter, sans-serif', fontSize: '13px' }}
              >
                {post.title}
              </span>

              {/* Status */}
              <span
                className="text-xs flex-shrink-0"
                style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}
              >
                {post.is_published ? 'Published' : 'Draft'}
              </span>

              {/* Edit */}
              <button
                onClick={() => openEdit(post)}
                className="text-xs flex-shrink-0 font-medium uppercase tracking-wider hover:underline"
                style={{ color: '#ff5c35', fontFamily: 'Inter, sans-serif' }}
              >
                Edit
              </button>

              {/* View */}
              <Link
                href={`/news/${post.slug}`}
                className="text-xs flex-shrink-0 uppercase tracking-wider hover:underline"
                style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}
              >
                View
              </Link>

              {/* Delete */}
              <button
                onClick={() => handleDelete(post.id)}
                disabled={deletingId === post.id}
                className="text-xs flex-shrink-0 font-medium uppercase tracking-wider hover:underline disabled:opacity-40"
                style={{ color: '#dc2626', fontFamily: 'Inter, sans-serif' }}
              >
                {deletingId === post.id
                  ? <Loader2 className="w-3 h-3 animate-spin inline" />
                  : 'Delete'
                }
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
