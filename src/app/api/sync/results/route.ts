import { NextResponse } from 'next/server'

// Alias — triggers the same cron sync endpoint
export async function POST() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/cron/sync-results`, {
    method: 'POST',
  })
  const data = await res.json()
  return NextResponse.json(data)
}
