import { NextResponse } from 'next/server'

const API_BASE = 'https://v3.football.api-sports.io'
const API_KEY  = process.env.API_FOOTBALL_KEY ?? ''

export const dynamic = 'force-dynamic'

// GET /api/admin/find-league?q=World+Cup
// Searches api-football leagues by name so you can find the correct WC 2026 ID
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q') ?? 'World Cup'

  const res  = await fetch(`${API_BASE}/leagues?search=${encodeURIComponent(q)}`, {
    headers: { 'x-apisports-key': API_KEY },
    next: { revalidate: 0 },
  })
  const data = await res.json()

  const leagues = (data.response ?? []).map((entry: any) => ({
    id:      entry.league.id,
    name:    entry.league.name,
    type:    entry.league.type,
    country: entry.country?.name ?? '—',
    seasons: (entry.seasons ?? []).map((s: any) => s.year),
  }))

  return NextResponse.json({ results: leagues, total: leagues.length })
}
