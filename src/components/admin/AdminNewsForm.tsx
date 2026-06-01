'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Check } from 'lucide-react'
import RichTextEditor from './RichTextEditor'

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
  post?: Post            // if provided → edit mode
  onClose: () => void
  onSaved: (post: Post) => void
}

function makeSlug(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now()
}

const inputStyle = {
  border: '1px solid #e0dbd3',
  fontFamily: 'Inter, sans-serif',
  fontSize: '13px',
  color: '#141414',
  background: '#ffffff',
  padding: '8px 12px',
  width: '100%',
  outline: 'none',
} as const

export default function AdminNewsForm({ authorId, post, onClose, onSaved }: Props) {
  const isEdit = !!post

  const [title,      setTitle]      = useState(post?.title      ?? '')
  const [excerpt,    setExcerpt]    = useState(post?.excerpt     ?? '')
  const [body,       setBody]       = useState(post?.body        ?? '')
  const [imageUrl,   setImageUrl]   = useState(post?.image_url   ?? '')
  const [publish,    setPublish]    = useState(post?.is_published ?? true)
  const [saving,     setSaving]     = useState(false)
  const [uploading,  setUploading]  = useState(false)
  const [done,       setDone]       = useState(false)
  const [error,      setError]      = useState('')

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    const supabase = createClient()
    const ext  = file.name.split('.').pop()
    const path = `news/${Date.now()}.${ext}`
    const { error: uploadErr } = await supabase.storage
      .from('news-images')
      .upload(path, file, { upsert: true })
    if (uploadErr) { setError('Image upload failed: ' + uploadErr.message); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('news-images').getPublicUrl(path)
    setImageUrl(publicUrl)
    setUploading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim())          { setError('Title is required'); return }
    if (!body || body === '<p></p>') { setError('Body is required'); return }
    setSaving(true); setError('')

    const supabase = createClient()
    let result: Post | null = null

    if (isEdit) {
      const { data, error: err } = await supabase
        .from('news_posts')
        .update({
          title:        title.trim(),
          excerpt:      excerpt.trim() || null,
          body:         body,
          image_url:    imageUrl.trim() || null,
          is_published: publish,
          published_at: publish ? (post.published_at ?? new Date().toISOString()) : null,
        })
        .eq('id', post.id)
        .select()
        .single()
      if (err) { setSaving(false); setError(err.message); return }
      result = data as Post
    } else {
      const { data, error: err } = await supabase
        .from('news_posts')
        .insert({
          author_id:    authorId,
          title:        title.trim(),
          slug:         makeSlug(title),
          excerpt:      excerpt.trim() || null,
          body:         body,
          image_url:    imageUrl.trim() || null,
          is_published: publish,
          published_at: publish ? new Date().toISOString() : null,
        })
        .select()
        .single()
      if (err) { setSaving(false); setError(err.message); return }
      result = data as Post
    }

    setSaving(false)
    setDone(true)
    setTimeout(() => {
      if (result) onSaved(result)
    }, 800)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between mb-1">
        <h3
          className="text-sm font-semibold uppercase tracking-wider"
          style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}
        >
          {isEdit ? 'Edit post' : 'New post'}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-xs"
          style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}
        >
          Cancel
        </button>
      </div>

      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Title"
        style={inputStyle}
      />

      <input
        value={excerpt}
        onChange={e => setExcerpt(e.target.value)}
        placeholder="Short excerpt (shown on homepage cards — optional)"
        style={inputStyle}
      />

      {/* Header image */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}>
          Header image
        </p>

        {/* Preview */}
        {imageUrl && (
          <div className="relative mb-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="" className="w-full object-cover" style={{ height: '140px', border: '1px solid #e0dbd3' }} />
            <button
              type="button"
              onClick={() => setImageUrl('')}
              className="absolute top-1.5 right-1.5 text-xs px-2 py-0.5"
              style={{ background: '#141414', color: '#ffffff', fontFamily: 'Inter, sans-serif' }}
            >
              ✕ Remove
            </button>
          </div>
        )}

        {/* Upload or paste URL */}
        <div className="flex gap-2">
          <label
            className="flex-shrink-0 text-xs font-semibold px-3 py-2 cursor-pointer transition-colors"
            style={{ background: uploading ? '#e0dbd3' : '#141414', color: uploading ? '#6b6b6b' : '#ffffff', fontFamily: 'Inter, sans-serif' }}
          >
            {uploading ? 'Uploading…' : '⬆ Upload'}
            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
          </label>
          <input
            value={imageUrl}
            onChange={e => setImageUrl(e.target.value)}
            placeholder="Or paste an image URL…"
            style={{ ...inputStyle, flex: 1 }}
          />
        </div>
      </div>

      {/* Rich text editor */}
      <RichTextEditor content={body} onChange={setBody} />

      <label
        className="flex items-center gap-2 text-xs cursor-pointer"
        style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}
      >
        <input
          type="checkbox"
          checked={publish}
          onChange={e => setPublish(e.target.checked)}
        />
        Publish immediately
      </label>

      {error && (
        <p className="text-xs" style={{ color: '#dc2626', fontFamily: 'Inter, sans-serif' }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={saving || done}
        className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider px-5 py-2.5 transition-colors"
        style={{
          background: saving || done ? '#e0dbd3' : '#141414',
          color:      saving || done ? '#6b6b6b' : '#ffffff',
          fontFamily: 'Inter, sans-serif',
          cursor:     saving || done ? 'not-allowed' : 'pointer',
        }}
      >
        {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        {done   && <Check   className="w-3.5 h-3.5" />}
        {done ? 'Saved!' : isEdit ? 'Save changes' : 'Publish'}
      </button>
    </form>
  )
}
