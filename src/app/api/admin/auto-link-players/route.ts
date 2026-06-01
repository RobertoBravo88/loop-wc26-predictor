import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const API_BASE = 'https://v3.football.api-sports.io'
const API_KEY  = process.env.API_FOOTBALL_KEY ?? ''

export const dynamic   = 'force-dynamic'
export const maxDuration = 300

// Normalize a name for comparison: lowercase, strip diacritics, strip non-alpha
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics
    .replace(/[^a-z\s'-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// ── GET: diagnostic — shows what the auto-link would work with ──
export async function GET() {
  const supabase = createServiceClient()

  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, api_id')
    .not('api_id', 'is', null)

  const teamsWithApiId = teams?.length ?? 0

  // Count unlinked players per team
  const { count: totalUnlinked } = await supabase
    .from('players')
    .select('id', { count: 'exact', head: true })
    .is('api_id', null)

  // Pick the first team that has unlinked players for a sample
  let sample: any = null
  for (const team of teams ?? []) {
    const { data: unlinked } = await supabase
      .from('players')
      .select('id, name')
      .eq('team_id', team.id)
      .is('api_id', null)
      .limit(5)

    if (!unlinked?.length) continue

    // Fetch squad from api-football
    const res = await fetch(`${API_BASE}/players/squads?team=${team.api_id}`, {
      headers: { 'x-apisports-key': API_KEY },
      next: { revalidate: 0 },
    })
    const data = await res.json()
    const apiPlayers = (data.response?.[0]?.players ?? []).slice(0, 5).map((p: any) => ({
      id: p.id, name: p.name, norm: norm(p.name),
    }))

    sample = {
      team: team.name,
      api_id: team.api_id,
      unlinkedInDb: unlinked.map(p => ({ name: p.name, norm: norm(p.name) })),
      apiSquadSample: apiPlayers,
      apiSquadTotal: data.response?.[0]?.players?.length ?? 0,
    }
    break
  }

  return NextResponse.json({ teamsWithApiId, totalUnlinked, sample })
}

export async function POST() {
  const supabase = createServiceClient()

  // All teams that have an api_id
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, api_id')
    .not('api_id', 'is', null)

  let totalLinked = 0
  const report: Array<{ team: string; linked: number; unmatched: string[] }> = []

  for (const team of teams ?? []) {
    // Unlinked players for this team
    const { data: unlinked } = await supabase
      .from('players')
      .select('id, name')
      .eq('team_id', team.id)
      .is('api_id', null)

    if (!unlinked?.length) continue

    // Fetch squad from api-football
    const res = await fetch(`${API_BASE}/players/squads?team=${team.api_id}`, {
      headers: { 'x-apisports-key': API_KEY },
      next: { revalidate: 0 },
    })
    const data = await res.json()
    const apiPlayers: Array<{ id: number; name: string }> =
      (data.response?.[0]?.players ?? []).map((p: any) => ({ id: p.id, name: p.name }))

    if (!apiPlayers.length) continue

    // Build lookup maps
    const byExact = new Map<string, number>()          // normalised full name → api_id
    const lastCount = new Map<string, number>()        // last word count (for uniqueness check)
    const byLast  = new Map<string, number>()          // normalised last word → api_id

    for (const ap of apiPlayers) {
      const n    = norm(ap.name)
      const last = n.split(' ').pop()!
      byExact.set(n, ap.id)
      lastCount.set(last, (lastCount.get(last) ?? 0) + 1)
      byLast.set(last, ap.id)
    }

    let teamLinked = 0
    const unmatched: string[] = []

    for (const player of unlinked) {
      const n    = norm(player.name)
      const last = n.split(' ').pop()!

      // Tier 1: exact normalised name
      let apiId: number | null = byExact.get(n) ?? null

      // Tier 2: unique surname match
      if (!apiId && (lastCount.get(last) ?? 0) === 1) {
        apiId = byLast.get(last) ?? null
      }

      if (apiId) {
        const { error } = await supabase
          .from('players')
          .update({ api_id: apiId })
          .eq('id', player.id)
        if (!error) { teamLinked++; totalLinked++ }
      } else {
        unmatched.push(player.name)
      }
    }

    if (teamLinked > 0 || unmatched.length > 0) {
      report.push({ team: team.name, linked: teamLinked, unmatched })
    }
  }

  return NextResponse.json({ totalLinked, report })
}
