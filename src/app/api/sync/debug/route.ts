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
      teams: (data.response ?? []).map((e: any) => ({ id: e.team.id, name: e.team.name })),
    })
  }

  if (mode === 'findteam') {
    const name = searchParams.get('name') ?? ''
    const url = `${API_BASE}/teams?name=${encodeURIComponent(name)}`
    const res = await fetch(url, { headers: { 'x-apisports-key': API_KEY }, next: { revalidate: 0 } })
    const data = await res.json()
    return NextResponse.json({
      results: (data.response ?? []).map((e: any) => ({ id: e.team.id, name: e.team.name, country: e.team.country })),
    })
  }

  // Check squad for a single team by api_id — e.g. ?mode=squad&teamid=88
  if (mode === 'squad') {
    const teamId = searchParams.get('teamid') ?? ''
    if (!teamId) return NextResponse.json({ error: 'Pass ?teamid=<api_id>' }, { status: 400 })

    // Try with WC 2026 league+season filter first
    const urlWith = `${API_BASE}/players/squads?team=${teamId}&league=1&season=2026`
    const resWith = await fetch(urlWith, { headers: { 'x-apisports-key': API_KEY }, next: { revalidate: 0 } })
    const dataWith = await resWith.json()

    // Also try without filter for comparison
    const urlWithout = `${API_BASE}/players/squads?team=${teamId}`
    const resWithout = await fetch(urlWithout, { headers: { 'x-apisports-key': API_KEY }, next: { revalidate: 0 } })
    const dataWithout = await resWithout.json()

    return NextResponse.json({
      with_wc_filter: {
        count: dataWith.results,
        players: (dataWith.response?.[0]?.players ?? []).map((p: any) => ({ id: p.id, name: p.name, number: p.number })),
      },
      without_filter: {
        count: dataWithout.results,
        players: (dataWithout.response?.[0]?.players ?? []).map((p: any) => ({ id: p.id, name: p.name, number: p.number })),
      },
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
