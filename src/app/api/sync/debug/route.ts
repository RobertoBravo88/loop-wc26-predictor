import { NextResponse } from 'next/server'

const API_BASE = 'https://v3.football.api-sports.io'
const API_KEY  = process.env.API_FOOTBALL_KEY ?? ''

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('mode') ?? 'leagues'

  if (mode === 'teams') {
    // Check what teams are returned for WC 2026
    const url = `${API_BASE}/teams?league=1&season=2026`
    const res = await fetch(url, { headers: { 'x-apisports-key': API_KEY }, next: { revalidate: 0 } })
    const data = await res.json()
    return NextResponse.json({
      total: data.results,
      errors: data.errors,
      teams: (data.response ?? []).slice(0, 5).map((e: any) => ({ id: e.team.id, name: e.team.name })),
    })
  }

  if (mode === 'status') {
    // Check API key status and remaining calls
    const url = `${API_BASE}/status`
    const res = await fetch(url, { headers: { 'x-apisports-key': API_KEY }, next: { revalidate: 0 } })
    const data = await res.json()
    return NextResponse.json(data.response ?? data)
  }

  // Default: league search
  const query = searchParams.get('q') ?? 'World Cup'
  const url = `${API_BASE}/leagues?search=${encodeURIComponent(query)}`
  const res = await fetch(url, { headers: { 'x-apisports-key': API_KEY }, next: { revalidate: 0 } })
  const data = await res.json()

  const leagues = (data.response ?? []).map((entry: any) => ({
    id:      entry.league.id,
    name:    entry.league.name,
    type:    entry.league.type,
    seasons: entry.seasons?.map((s: any) => s.year) ?? [],
  }))

  return NextResponse.json({ results: leagues })
}
