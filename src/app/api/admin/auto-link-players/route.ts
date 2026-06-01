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

// ── GET: diagnostic — which teams still have unlinked players ──
export async function GET() {
  const supabase = createServiceClient()

  // All unlinked players with their team info
  const { data: unlinked } = await supabase
    .from('players')
    .select('id, name, team_id, team:teams(id, name, api_id)')
    .is('api_id', null)

  // Group by team
  const byTeam = new Map<string, { name: string; api_id: number | null; count: number; sample: string[] }>()
  for (const p of unlinked ?? []) {
    const t = p.team as any
    if (!t) continue
    const existing = byTeam.get(t.id)
    if (existing) {
      existing.count++
      if (existing.sample.length < 3) existing.sample.push(p.name)
    } else {
      byTeam.set(t.id, { name: t.name, api_id: t.api_id, count: 1, sample: [p.name] })
    }
  }

  const teams = [...byTeam.values()].sort((a, b) => b.count - a.count)
  const noApiId = teams.filter(t => !t.api_id)
  const hasApiId = teams.filter(t => t.api_id)

  return NextResponse.json({
    totalUnlinked: unlinked?.length ?? 0,
    teamsWithNoApiId: noApiId,
    teamsWithApiId: hasApiId,
  })
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

      // After norm(), "H. Kane" → "h kane" (period stripped), "K. Mbappé" → "k mbappe"
      // Detect abbreviated names by checking if the first word is a single letter
      const apWords = n.split(' ')
      if (apWords.length >= 2 && apWords[0].length === 1) {
        const initial = apWords[0]
        const surname = apWords[apWords.length - 1]  // last word = surname
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
        //
        // MERGE strategy (handles scorer_picks / favourite_player_id FK blocks):
        //   1. Enrich the squad-sync player with Wikipedia full name + age + club.
        //   2. Transfer ALL scorer_picks references: Wikipedia → squad-sync.
        //   3. Transfer ALL favourite_player_id references: Wikipedia → squad-sync.
        //   4. Delete the now-orphaned Wikipedia duplicate.

        // 1. Enrich squad-sync player with Wikipedia data
        const enrichment: Record<string, any> = { name: player.name }
        if ((player as any).age  != null) enrichment.age  = (player as any).age
        if ((player as any).club != null) enrichment.club = (player as any).club
        await supabase.from('players').update(enrichment).eq('id', existingLinked.id)

        // 2. Move scorer_picks from Wikipedia player → squad-sync player
        await supabase
          .from('scorer_picks')
          .update({ player_id: existingLinked.id })
          .eq('player_id', player.id)

        // 3. Move favourite_player_id references
        await supabase
          .from('profiles')
          .update({ favourite_player_id: existingLinked.id })
          .eq('favourite_player_id', player.id)

        // 4. Delete the now-orphaned Wikipedia record
        const { error: delErr } = await supabase
          .from('players')
          .delete()
          .eq('id', player.id)

        if (!delErr) {
          teamResolved++; totalResolved++
        } else {
          // Still blocked — revert name change and skip
          await supabase.from('players').update({ name: existingLinked.name }).eq('id', existingLinked.id)
          skipped.push(player.name); totalSkipped++
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
