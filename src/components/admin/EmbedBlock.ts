import { Node, mergeAttributes } from '@tiptap/core'

/**
 * Custom Tiptap node for raw HTML embeds (tweets, videos, etc.)
 * The raw HTML is stored URI-encoded in a data attribute so Tiptap's
 * schema never touches or strips it. The article page decodes it on render.
 */
export const EmbedBlock = Node.create({
  name: 'embedBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      html: {
        default: '',
        parseHTML: el =>
          decodeURIComponent(el.getAttribute('data-embed-html') ?? ''),
        renderHTML: attrs => ({
          'data-embed-html': encodeURIComponent(attrs.html as string),
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-embed-html]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes)]
  },

  // Shows a preview inside the editor so the admin can see what was inserted
  addNodeView() {
    return ({ node }) => {
      const wrapper = document.createElement('div')
      wrapper.style.cssText = [
        'border: 1px dashed #e0dbd3',
        'padding: 10px 14px',
        'margin: 10px 0',
        'background: #faf9f6',
        'border-radius: 2px',
        'pointer-events: none',
        'user-select: none',
      ].join(';')

      const label = document.createElement('div')
      label.style.cssText = 'font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.08em; font-family: Inter,sans-serif; margin-bottom: 6px;'
      label.textContent = '⬡ HTML Embed'

      const preview = document.createElement('div')
      preview.style.cssText = 'font-size: 11px; color: #6b6b6b; font-family: monospace; white-space: pre-wrap; word-break: break-all;'
      // Show a short preview of the raw HTML so admin knows what's there
      const snippet = (node.attrs.html as string).slice(0, 120)
      preview.textContent = snippet + (node.attrs.html.length > 120 ? '…' : '')

      wrapper.appendChild(label)
      wrapper.appendChild(preview)

      return { dom: wrapper }
    }
  },
})
