import { NextResponse } from 'next/server'

const API_BASE = 'https://v3.football.api-sports.io'
const API_KEY  = process.env.API_FOOTBALL_KEY ?? ''

export const dynamic = 'force-dynamic'

async function search(q: string) {
  const res  = await fetch(`${API_BASE}/leagues?search=${encodeURIComponent(q)}`, {
    headers: { 'x-apisports-key': API_KEY },
    next: { revalidate: 0 },
  })
  const data = await res.json()

  return (data.response ?? []).map((entry: any) => ({
    id:      entry.league.id,
    name:    entry.league.name,
    type:    entry.league.type,
    country: entry.country?.name ?? '—',
    seasons: (entry.seasons ?? []).map((s: any) => s.year).join(', '),
  }))
}

// GET for direct browser access
export async function GET(req: Request) {
  const q      = new URL(req.url).searchParams.get('q') ?? 'World Cup'
  const leagues = await search(q)
  return NextResponse.json({ results: leagues, total: leagues.length })
}

// POST for AdminSyncButton — tests the fixtures endpoint with AND without page=1
// to isolate whether the pagination param is causing the issue
export async function POST() {
  // Test 1: without page param (same as the working test)
  const res1   = await fetch(`${API_BASE}/fixtures?league=1&season=2026`, {
    headers: { 'x-apisports-key': API_KEY },
    next: { revalidate: 0 },
  })
  const data1  = await res1.json()
  const count1 = data1.response?.length ?? 0
  const errors1 = JSON.stringify(data1.errors ?? {})

  // Test 2: with page=1 (how getAll calls it)
  const res2   = await fetch(`${API_BASE}/fixtures?league=1&season=2026&page=1`, {
    headers: { 'x-apisports-key': API_KEY },
    next: { revalidate: 0 },
  })
  const data2  = await res2.json()
  const count2 = data2.response?.length ?? 0
  const errors2 = JSON.stringify(data2.errors ?? {})

  // Also check remaining API requests
  const remaining = res1.headers.get('x-ratelimit-requests-remaining') ?? res2.headers.get('x-ratelimit-requests-remaining') ?? 'unknown'

  return NextResponse.json({
    message: [
      `Without page: ${count1} fixtures | errors: ${errors1}`,
      `With page=1:  ${count2} fixtures | errors: ${errors2}`,
      `API requests remaining: ${remaining}`,
    ].join(' — '),
  })
}
