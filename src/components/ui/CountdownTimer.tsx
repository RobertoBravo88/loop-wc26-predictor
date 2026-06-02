'use client'

import { useState, useEffect } from 'react'

export default function CountdownTimer({ targetDate }: { targetDate: string }) {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    function tick() {
      const now  = new Date().getTime()
      const end  = new Date(targetDate).getTime()
      const diff = end - now

      if (diff <= 0) {
        setStarted(true)
        setTimeLeft(null)
        return
      }

      setStarted(false)
      setTimeLeft({
        days:    Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours:   Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      })
    }

    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [targetDate])

  if (started) {
    return (
      <div className="flex items-center gap-2 mt-3">
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#ff5c35', fontFamily: 'Inter, sans-serif' }}>
          ⚽ Tournament is LIVE
        </span>
      </div>
    )
  }

  if (!timeLeft) return null

  const units = [
    { label: 'Days',    value: timeLeft.days    },
    { label: 'Hours',   value: timeLeft.hours   },
    { label: 'Minutes', value: timeLeft.minutes },
    { label: 'Seconds', value: timeLeft.seconds },
  ]

  return (
    <div className="flex items-end gap-3 mt-4">
      {units.map(({ label, value }) => (
        <div key={label} className="text-center">
          <div
            className="text-3xl font-bold leading-none mb-0.5 tabular-nums"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", color: '#ffffff', minWidth: '2.5rem' }}
          >
            {String(value).padStart(2, '0')}
          </div>
          <div className="text-xs uppercase tracking-wider" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
            {label}
          </div>
        </div>
      ))}
      <div className="mb-1 text-xs uppercase tracking-wider" style={{ color: '#ff5c35', fontFamily: 'Inter, sans-serif' }}>
        Until kick-off
      </div>
    </div>
  )
}
