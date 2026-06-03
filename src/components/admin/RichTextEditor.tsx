'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TiptapLink from '@tiptap/extension-link'
import TiptapImage from '@tiptap/extension-image'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Link2, ImageIcon, Loader2, Unlink2, Code2 } from 'lucide-react'
import { EmbedBlock } from './EmbedBlock'

interface Props {
  content: string
  onChange: (html: string) => void
}

export default function RichTextEditor({ content, onChange }: Props) {
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      TiptapLink.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'rte-link' },
      }),
      TiptapImage.configure({
        HTMLAttributes: { class: 'rte-image' },
      }),
      EmbedBlock,
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'rte-content',
      },
    },
  })

  // Reset content when switching between posts (edit mode)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content || '')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content])

  if (!editor) return null

  function handleLink() {
    const prev = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('Link URL:', prev ?? 'https://')
    if (url === null) return // cancelled
    if (!url.trim()) {
      editor.chain().focus().unsetLink().run()
    } else {
      editor.chain().focus().setLink({ href: url.trim() }).run()
    }
  }

  function handleEmbed() {
    const raw = window.prompt('Paste embed HTML (blockquote only — no <script> line):')
    if (!raw?.trim()) return
    editor.chain().focus().insertContent({
      type: 'embedBlock',
      attrs: { html: raw.trim() },
    }).run()
  }

  async function handleImageFile(file: File) {
    setUploading(true)
    const supabase = createClient()
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from('news-images').upload(path, file)
    if (error) {
      setUploading(false)
      alert('Image upload failed: ' + error.message)
      return
    }
    const { data: { publicUrl } } = supabase.storage.from('news-images').getPublicUrl(path)
    editor.chain().focus().setImage({ src: publicUrl, alt: file.name }).run()
    setUploading(false)
  }

  const isLinkActive = editor.isActive('link')

  return (
    <div style={{ border: '1px solid #e0dbd3' }}>
      {/* Toolbar */}
      <div
        className="flex items-center gap-0.5 px-2 py-1.5"
        style={{ borderBottom: '1px solid #e0dbd3', background: '#faf9f7' }}
      >
        {/* Bold */}
        <button
          type="button"
          title="Bold"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className="flex items-center justify-center w-7 h-7 rounded text-sm font-bold transition-colors"
          style={{
            background: editor.isActive('bold') ? '#141414' : 'transparent',
            color: editor.isActive('bold') ? '#ffffff' : '#6b6b6b',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          B
        </button>

        {/* Italic */}
        <button
          type="button"
          title="Italic"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className="flex items-center justify-center w-7 h-7 rounded text-sm italic font-medium transition-colors"
          style={{
            background: editor.isActive('italic') ? '#141414' : 'transparent',
            color: editor.isActive('italic') ? '#ffffff' : '#6b6b6b',
            fontFamily: 'Georgia, serif',
          }}
        >
          I
        </button>

        {/* Divider */}
        <div className="w-px h-4 mx-1" style={{ background: '#e0dbd3' }} />

        {/* Link */}
        <button
          type="button"
          title={isLinkActive ? 'Edit link' : 'Add link'}
          onClick={handleLink}
          className="flex items-center justify-center w-7 h-7 rounded transition-colors"
          style={{
            background: isLinkActive ? '#141414' : 'transparent',
            color: isLinkActive ? '#ffffff' : '#6b6b6b',
          }}
        >
          <Link2 className="w-3.5 h-3.5" />
        </button>

        {/* Unlink — only shown when cursor is on a link */}
        {isLinkActive && (
          <button
            type="button"
            title="Remove link"
            onClick={() => editor.chain().focus().unsetLink().run()}
            className="flex items-center justify-center w-7 h-7 rounded transition-colors"
            style={{ color: '#6b6b6b' }}
          >
            <Unlink2 className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Divider */}
        <div className="w-px h-4 mx-1" style={{ background: '#e0dbd3' }} />

        {/* Image upload */}
        <button
          type="button"
          title="Insert image"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="flex items-center justify-center w-7 h-7 rounded transition-colors"
          style={{ color: '#6b6b6b' }}
        >
          {uploading
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <ImageIcon className="w-3.5 h-3.5" />
          }
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) handleImageFile(file)
            e.target.value = ''
          }}
        />

        {/* Embed HTML (tweets, videos) */}
        <button
          type="button"
          title="Insert HTML embed (tweet, video…)"
          onClick={handleEmbed}
          className="flex items-center justify-center w-7 h-7 rounded transition-colors"
          style={{ color: '#6b6b6b' }}
        >
          <Code2 className="w-3.5 h-3.5" />
        </button>

        <span
          className="ml-auto text-xs"
          style={{ color: '#c4bfb8', fontFamily: 'Inter, sans-serif' }}
        >
          Select text, then format
        </span>
      </div>

      {/* Editor area */}
      <style>{`
        .rte-content {
          min-height: 220px;
          padding: 12px 16px;
          outline: none;
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          color: #141414;
          line-height: 1.7;
        }
        .rte-content p { margin: 0 0 0.75em 0; }
        .rte-content p:last-child { margin-bottom: 0; }
        .rte-content strong { font-weight: 700; }
        .rte-content em { font-style: italic; }
        .rte-link {
          color: #ff5c35;
          text-decoration: underline;
          cursor: pointer;
        }
        .rte-image {
          max-width: 100%;
          height: auto;
          display: block;
          margin: 16px 0;
        }
        .rte-content p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          color: #c4bfb8;
          pointer-events: none;
          float: left;
          height: 0;
        }
      `}</style>
      <EditorContent editor={editor} />
    </div>
  )
}
