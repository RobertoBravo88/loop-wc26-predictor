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

// POST for AdminSyncButton — tests the fixtures endpoint directly and reports back
export async function POST() {
  const res  = await fetch(`${API_BASE}/fixtures?league=1&season=2026`, {
    headers: { 'x-apisports-key': API_KEY },
    next: { revalidate: 0 },
  })
  const data = await res.json()

  const count   = data.response?.length ?? 0
  const paging  = data.paging ?? {}
  const errors  = data.errors ?? {}
  const hasErr  = Object.keys(errors).length > 0

  if (hasErr) {
    return NextResponse.json({ message: `API error: ${JSON.stringify(errors)}` })
  }

  if (count === 0) {
    return NextResponse.json({
      message: `Fixtures endpoint returned 0 results. HTTP ${res.status}. Paging: ${JSON.stringify(paging)}. Check your API plan — free tier may not include WC fixtures.`,
    })
  }

  return NextResponse.json({
    message: `✓ Found ${count} fixtures on page 1 of ${paging.total ?? 1}. Total should be 104. Paging: ${JSON.stringify(paging)}`,
  })
}
