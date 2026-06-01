import { NextResponse } from 'next/server'

const API_BASE = 'https://v3.football.api-sports.io'
const API_KEY  = process.env.API_FOOTBALL_KEY ?? ''

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q         = (searchParams.get('q') ?? '').trim()
  const teamApiId = searchParams.get('teamApiId')

  try {
    // Primary strategy: fetch the team's full squad and filter locally.
    // This works pre-tournament and is much more reliable than name search.
    if (teamApiId) {
      const res = await fetch(`${API_BASE}/players/squads?team=${teamApiId}`, {
        headers: { 'x-apisports-key': API_KEY },
        next: { revalidate: 0 },
      })
      const data = await res.json()
      const all: Array<{ id: number; name: string; photo: string | null }> =
        (data.response?.[0]?.players ?? []).map((p: any) => ({
          id:          p.id,
          name:        p.name,
          nationality: null,
          photo:       p.photo ?? null,
        }))

      const filtered = q.length >= 2
        ? all.filter(p => p.name.toLowerCase().includes(q.toLowerCase()))
        : all

      return NextResponse.json({ players: filtered })
    }

    // Fallback: global name search (less reliable, used when team api_id unknown)
    if (q.length < 3) return NextResponse.json({ players: [] })

    const res = await fetch(
      `${API_BASE}/players?search=${encodeURIComponent(q)}&league=1&season=2026`,
      { headers: { 'x-apisports-key': API_KEY }, next: { revalidate: 0 } }
    )
    const data = await res.json()
    const players = (data.response ?? []).map((entry: any) => ({
      id:          entry.player.id,
      name:        entry.player.name,
      nationality: entry.player.nationality,
      photo:       entry.player.photo ?? null,
    }))

    return NextResponse.json({ players: players.slice(0, 15) })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
