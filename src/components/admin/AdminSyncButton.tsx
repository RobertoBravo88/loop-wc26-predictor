'use client'

import { useState } from 'react'
import { Loader2, Check, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  endpoint: string
  label: string
  variant?: 'default' | 'primary'
  batched?: boolean   // set true for endpoints that support ?offset= batching
}

export default function AdminSyncButton({ endpoint, label, variant = 'default', batched = false }: Props) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleClick() {
    setState('loading')
    setMessage('')

    try {
      if (batched) {
        // Run batches sequentially until the server says "all done"
        let offset = 0
        let lastMessage = ''
        while (true) {
          const res = await fetch(`${endpoint}?offset=${offset}`, { method: 'POST' })
          const data = await res.json()
          if (data.error) throw new Error(data.error)
          lastMessage = data.message ?? 'Done'
          if (!lastMessage.includes('next batch')) break
          // parse next offset from message
          const match = lastMessage.match(/offset=(\d+)/)
          if (!match) break
          offset = parseInt(match[1], 10)
        }
        setMessage(lastMessage)
      } else {
        const res = await fetch(endpoint, { method: 'POST' })
        const data = await res.json()
        setMessage(data.message ?? data.error ?? 'Done')
      }
      setState('done')
    } catch (e: any) {
      setMessage(e.message)
      setState('error')
    }

    setTimeout(() => setState('idle'), 8000)
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleClick}
        disabled={state === 'loading'}
        className={cn(
          'flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60',
          variant === 'primary'
            ? 'bg-[#ff5c35] hover:bg-[#e04a26] text-white'
            : 'border border-gray-200 hover:border-gray-300 text-gray-700'
        )}
      >
        {state === 'loading' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
         state === 'done'    ? <Check className="w-3.5 h-3.5" /> :
         <RefreshCw className="w-3.5 h-3.5" />}
        {state === 'loading' && batched ? 'Syncing...' : label}
      </button>
      {message && (
        <span className={`text-xs ${state === 'error' ? 'text-red-500' : 'text-green-600'}`}>
          {message}
        </span>
      )}
    </div>
  )
}
