'use client'

/**
 * Renders a date/time string in the user's local browser timezone.
 * Use instead of date-fns format() in server components for any
 * time that includes HH:mm — otherwise Vercel's UTC timezone is used.
 *
 * suppressHydrationWarning silences the expected server/client mismatch
 * (server renders UTC, client re-renders in local timezone after mount).
 */

import { format } from 'date-fns'
import { useEffect, useState } from 'react'

interface Props {
  date: string | Date
  /** date-fns format string — defaults to 'dd MMM · HH:mm' */
  fmt?: string
}

export default function LocalTime({ date, fmt = 'dd MMM · HH:mm' }: Props) {
  const [display, setDisplay] = useState(format(new Date(date), fmt))

  useEffect(() => {
    setDisplay(format(new Date(date), fmt))
  }, [date, fmt])

  return (
    <time
      suppressHydrationWarning
      dateTime={typeof date === 'string' ? date : date.toISOString()}
    >
      {display}
    </time>
  )
}
