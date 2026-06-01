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

// POST for AdminSyncButton — returns a message string the button can display
export async function POST() {
  const leagues = await search('World Cup')

  if (!leagues.length) {
    return NextResponse.json({ message: 'No results — check API_FOOTBALL_KEY is set correctly' })
  }

  const lines = leagues.map((l: any) =>
    `ID ${l.id}: ${l.name} (${l.country}) — seasons: ${l.seasons}`
  ).join(' | ')

  return NextResponse.json({ message: lines })
}
