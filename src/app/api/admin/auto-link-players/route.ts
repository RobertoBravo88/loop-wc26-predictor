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
      unlinkedInDb: unlinked.map((p: { id: string; name: string }) => ({ name: p.name, norm: norm(p.name) })),
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

  let totalResolved = 0
  let totalSkipped  = 0
  const report: Array<{ team: string; resolved: number; skipped: string[] }> = []

  for (const team of teams ?? []) {
    // Unlinked players for this team (include age + club so we can carry them across)
    const { data: unlinked } = await supabase
      .from('players')
      .select('id, name, age, club')
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
    const byExact    = new Map<string, number>()
    const lastCount  = new Map<string, number>()
    const byLast     = new Map<string, number>()
    // Tier 3: "initial.surname" → api_id  (handles "K. Mbappé" ↔ "Kylian Mbappé")
    const byInitialSurname = new Map<string, number>()

    for (const ap of apiPlayers) {
      const n    = norm(ap.name)
      const last = n.split(' ').pop()!
      byExact.set(n, ap.id)
      lastCount.set(last, (lastCount.get(last) ?? 0) + 1)
      byLast.set(last, ap.id)

      // Build initial+surname key from abbreviated API names like "k. mbappe"
      const abbrMatch = n.match(/^([a-z])\.\s+(.+)$/)
      if (abbrMatch) {
        const initial = abbrMatch[1]
        const surname = abbrMatch[2].split(' ').pop()!
        byInitialSurname.set(`${initial}.${surname}`, ap.id)
      }
    }

    let teamResolved = 0
    const skipped: string[] = []

    for (const player of unlinked) {
      const n     = norm(player.name)
      const words = n.split(' ')
      const last  = words[words.length - 1]
      const first = words[0] ?? ''

      // Tier 1: exact normalised match
      let apiId: number | null = byExact.get(n) ?? null

      // Tier 2: unique surname match
      if (!apiId && (lastCount.get(last) ?? 0) === 1) {
        apiId = byLast.get(last) ?? null
      }

      // Tier 3: first initial + surname (catches "K. Mbappé" ↔ "Kylian Mbappé")
      if (!apiId && first.length > 0) {
        apiId = byInitialSurname.get(`${first[0]}.${last}`) ?? null
      }

      if (!apiId) { skipped.push(player.name); totalSkipped++; continue }

      // Check if this api_id is already taken by a squad-sync duplicate
      const { data: existingLinked } = await supabase
        .from('players')
        .select('id, name')
        .eq('api_id', apiId)
        .maybeSingle()

      if (existingLinked) {
        // The Wikipedia player is a duplicate of an already-linked squad-sync player.
        // Strategy:
        //   1. Promote the Wikipedia full name + age + club onto the linked player.
        //   2. Try to delete the Wikipedia duplicate.
        //   3. If deletion is blocked (FK refs like scorer_picks), reverse:
        //      delete the squad-sync duplicate and link the Wikipedia player instead.

        const enrichment: Record<string, any> = { name: player.name }
        if ((player as any).age  != null) enrichment.age  = (player as any).age
        if ((player as any).club != null) enrichment.club = (player as any).club

        await supabase
          .from('players')
          .update(enrichment)
          .eq('id', existingLinked.id)

        const { error: delWikiErr } = await supabase
          .from('players')
          .delete()
          .eq('id', player.id)

        if (!delWikiErr) {
          // Clean delete — Wikipedia duplicate removed, linked player has full name.
          teamResolved++; totalResolved++
        } else {
          // Wikipedia player has references (scorer_picks / favourite_player).
          // Reverse: delete the squad-sync player, then link the Wikipedia player.
          const { error: delSyncErr } = await supabase
            .from('players')
            .delete()
            .eq('id', existingLinked.id)

          if (!delSyncErr) {
            await supabase
              .from('players')
              .update({ api_id: apiId })
              .eq('id', player.id)
            teamResolved++; totalResolved++
          } else {
            // Both players have references — cannot auto-resolve.
            // Revert the name change.
            await supabase
              .from('players')
              .update({ name: existingLinked.name })
              .eq('id', existingLinked.id)
            skipped.push(player.name); totalSkipped++
          }
        }
      } else {
        // No duplicate — just link directly.
        const { error } = await supabase
          .from('players')
          .update({ api_id: apiId })
          .eq('id', player.id)
        if (!error) { teamResolved++; totalResolved++ }
        else { skipped.push(player.name); totalSkipped++ }
      }
    }

    if (teamResolved > 0 || skipped.length > 0) {
      report.push({ team: team.name, resolved: teamResolved, skipped })
    }
  }

  return NextResponse.json({
    message: `Resolved ${totalResolved} players. ${totalSkipped} could not be matched.`,
    totalResolved,
    totalSkipped,
    report,
  })
}
