'use client'

import { useEffect, useState } from 'react'

/**
 * Shows the daily leaderboard update time (09:00 UTC) in the
 * user's local browser timezone. Suppresses hydration mismatch
 * since server renders UTC and client re-renders locally.
 */
export default function DailyUpdateTime() {
  // Build a Date for today at 09:00 UTC
  const getUpdateDate = () => {
    const d = new Date()
    d.setUTCHours(9, 0, 0, 0)
    return d
  }

  const [display, setDisplay] = useState('11:00') // sensible SSR fallback (CEST)

  useEffect(() => {
    const d = getUpdateDate()
    setDisplay(
      d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
    )
  }, [])

  return <span suppressHydrationWarning>{display}</span>
}
