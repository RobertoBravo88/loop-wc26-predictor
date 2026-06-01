import { NextResponse } from 'next/server'

const API_BASE = 'https://v3.football.api-sports.io'
const API_KEY  = process.env.API_FOOTBALL_KEY ?? ''

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') ?? '').trim()
  if (q.length < 3) return NextResponse.json({ players: [] })

  async function fetchPlayers(params: Record<string, string>) {
    const url = new URL(`${API_BASE}/players`)
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
    const res = await fetch(url.toString(), {
      headers: { 'x-apisports-key': API_KEY },
      next: { revalidate: 0 },
    })
    const data = await res.json()
    return (data.response ?? []).map((entry: any) => ({
      id:          entry.player.id,
      name:        entry.player.name,
      nationality: entry.player.nationality,
      photo:       entry.player.photo ?? null,
    }))
  }

  try {
    // Try WC-scoped search first
    let players = await fetchPlayers({ search: q, league: '1', season: '2026' })

    // Fall back to broader search if nothing found (pre-tournament)
    if (players.length === 0) {
      players = await fetchPlayers({ search: q, season: '2026' })
    }

    return NextResponse.json({ players: players.slice(0, 10) })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
