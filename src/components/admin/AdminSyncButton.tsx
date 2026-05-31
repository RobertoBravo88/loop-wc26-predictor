'use client'

import { useState } from 'react'
import { Loader2, Check, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  endpoint: string
  label: string
  variant?: 'default' | 'primary'
}

export default function AdminSyncButton({ endpoint, label, variant = 'default' }: Props) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleClick() {
    setState('loading')
    try {
      const res = await fetch(endpoint, { method: 'POST' })
      const data = await res.json()
      setMessage(data.message ?? 'Done')
      setState('done')
    } catch (e: any) {
      setMessage(e.message)
      setState('error')
    }
    setTimeout(() => setState('idle'), 4000)
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleClick}
        disabled={state === 'loading'}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60',
          variant === 'primary'
            ? 'bg-[#ff5c35] hover:bg-[#e04a26] text-white'
            : 'border border-gray-200 hover:border-gray-300 text-gray-700'
        )}
      >
        {state === 'loading' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
         state === 'done'    ? <Check className="w-3.5 h-3.5" /> :
         <RefreshCw className="w-3.5 h-3.5" />}
        {label}
      </button>
      {message && (
        <span className={`text-xs ${state === 'error' ? 'text-red-500' : 'text-green-600'}`}>
          {message}
        </span>
      )}
    </div>
  )
}
