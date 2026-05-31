'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Check } from 'lucide-react'

export default function AdminNewsForm({ authorId }: { authorId: string }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [body, setBody] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [publish, setPublish] = useState(true)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  function slug(title: string) {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !body.trim()) { setError('Title and body are required'); return }
    setSaving(true); setError('')
    const supabase = createClient()
    const { error: e2 } = await supabase.from('news_posts').insert({
      author_id: authorId,
      title: title.trim(),
      slug: slug(title),
      excerpt: excerpt.trim() || null,
      body: body.trim(),
      image_url: imageUrl.trim() || null,
      is_published: publish,
      published_at: publish ? new Date().toISOString() : null,
    })
    setSaving(false)
    if (e2) { setError(e2.message); return }
    setDone(true)
    setTitle(''); setExcerpt(''); setBody(''); setImageUrl('')
    setTimeout(() => { setDone(false); setOpen(false) }, 2000)
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="bg-[#ff5c35] hover:bg-[#e04a26] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
        + Write a post
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 border border-gray-100 rounded-xl p-4">
      <h3 className="font-semibold text-gray-800 text-sm">New post</h3>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title"
        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5c35]" />
      <input value={excerpt} onChange={e => setExcerpt(e.target.value)} placeholder="Short excerpt (optional)"
        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5c35]" />
      <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Post body…" rows={6}
        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5c35] resize-none" />
      <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="Image URL (optional)"
        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5c35]" />
      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
        <input type="checkbox" checked={publish} onChange={e => setPublish(e.target.checked)} className="rounded" />
        Publish immediately
      </label>
      {error && <p className="text-red-500 text-xs">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={saving}
          className="bg-[#ff5c35] hover:bg-[#e04a26] text-white text-sm font-semibold px-4 py-2 rounded-xl flex items-center gap-2 disabled:opacity-60">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : done ? <Check className="w-3.5 h-3.5" /> : null}
          {done ? 'Published!' : 'Publish'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">
          Cancel
        </button>
      </div>
    </form>
  )
}
