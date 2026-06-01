import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const API_BASE = 'https://v3.football.api-sports.io'
const API_KEY  = process.env.API_FOOTBALL_KEY ?? ''

export const dynamic   = 'force-dynamic'
export const maxDuration = 300

/**
 * Normalize a name for comparison:
 * - lowercase
 * - replace chars that don't decompose in NFD (ø → o, đ → d, etc.)
 * - strip combining diacritics (é → e, ñ → n, ž → z, etc.)
 * - strip everything except a-z, space, apostrophe, hyphen
 * - collapse whitespace
 */
function norm(s: string): string {
  return s
    .toLowerCase()
    // Characters that do NOT decompose in NFD — map to ASCII before normalizing
    .replace(/ø/g, 'o').replace(/ð/g, 'd').replace(/þ/g, 'th')
    .replace(/æ/g, 'ae').replace(/ß/g, 'ss').replace(/ł/g, 'l')
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')  // strip combining diacritics
    .replace(/[^a-z\s'-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// ── GET: diagnostic ─────────────────────────────────────────────────────────
// ?teamApiId=X  → debug mode: show raw + normalised API squad for that team
// (no params)   → list teams with unlinked players
export async function GET(req: NextRequest) {
  const supabase = createServiceClient()

  // ── Debug mode ──
  const teamApiId = req.nextUrl.searchParams.get('teamApiId')
  if (teamApiId) {
    const res = await fetch(`${API_BASE}/players/squads?team=${teamApiId}`, {
      headers: { 'x-apisports-key': API_KEY },
      next: { revalidate: 0 },
    })
    const data = await res.json()
    const players = (data.response?.[0]?.players ?? []).map((p: any) => ({
      id:   p.id,
      name: p.name,
      norm: norm(p.name),
    }))
    return NextResponse.json({ teamApiId, count: players.length, players })
  }

  // ── Standard diagnostic ──
  const { data: unlinked } = await supabase
    .from('players')
    .select('id, name, team_id, team:teams(id, name, api_id)')
    .is('api_id', null)

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

  const teams   = [...byTeam.values()].sort((a, b) => b.count - a.count)
  const noApiId = teams.filter(t => !t.api_id)
  const hasApiId = teams.filter(t => t.api_id)

  return NextResponse.json({
    totalUnlinked: unlinked?.length ?? 0,
    teamsWithNoApiId: noApiId,
    teamsWithApiId: hasApiId,
  })
}

// ── POST: bulk auto-link ─────────────────────────────────────────────────────
export async function POST() {
  const supabase = createServiceClient()

  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, api_id')
    .not('api_id', 'is', null)

  let totalResolved = 0
  let totalSkipped  = 0
  const report: Array<{ team: string; apiSquadSize: number; resolved: number; skipped: string[] }> = []

  for (const team of teams ?? []) {
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

    // ── Build lookup maps ────────────────────────────────────────────────────
    const byExact          = new Map<string, number>()  // norm(full name) → api_id
    const lastCount        = new Map<string, number>()  // last word → count (for uniqueness)
    const byLast           = new Map<string, number>()  // last word → api_id
    const byInitialSurname = new Map<string, number>()  // "h.kane" → api_id (abbreviated API names)
    // Tier 4: reversed order — API uses "J. Park" for Wikipedia's "Park Jin-seob"
    // Key: "j.park" built from reversed word order
    const byReversed       = new Map<string, number>()

    for (const ap of apiPlayers) {
      const n     = norm(ap.name)
      const words = n.split(' ')
      const last  = words[words.length - 1]

      byExact.set(n, ap.id)
      lastCount.set(last, (lastCount.get(last) ?? 0) + 1)
      byLast.set(last, ap.id)

      if (words.length >= 2 && words[0].length === 1) {
        // Abbreviated first name: "H. Kane" → norm "h kane" → store "h.kane"
        byInitialSurname.set(`${words[0]}.${last}`, ap.id)
      }
    }

    // Tier 4 reversed: build from Wikipedia perspective would be done during lookup.
    // We pre-build: for each API player that has abbreviated format "X. Surname",
    // also store a reversed key "surname_initial.first_word" so Korean-style
    // "Park Jin-seob" can find API "J. Park" → "j.park".
    // This is already covered by byInitialSurname["j.park"]; the reversed lookup
    // below uses the WIKIPEDIA name to construct the reversed key.

    let teamResolved = 0
    const skipped: string[] = []

    for (const player of unlinked) {
      const n     = norm(player.name)
      const words = n.split(' ')
      const last  = words[words.length - 1]
      const first = words[0] ?? ''

      // ── Tier 1: exact normalised match ──────────────────────────────────
      let apiId: number | null = byExact.get(n) ?? null
      let matchTier = 1

      // ── Tier 2: unique surname ───────────────────────────────────────────
      if (!apiId && (lastCount.get(last) ?? 0) === 1) {
        apiId = byLast.get(last) ?? null
        matchTier = 2
      }

      // ── Tier 3: first-initial + surname ("Harry Kane" ↔ "H. Kane") ─────
      if (!apiId && first.length > 0) {
        apiId = byInitialSurname.get(`${first[0]}.${last}`) ?? null
        matchTier = 3
      }

      // ── Tier 4: reversed name order ("Park Jin-seob" ↔ "J. Park") ─────
      // Wikipedia: first="park", last="jin-seob"
      // We look for initial-of-last . first  →  "j.park"
      if (!apiId && words.length >= 2 && last.length > 0) {
        const reversedKey = `${last[0]}.${first}`
        apiId = byInitialSurname.get(reversedKey) ?? null
        matchTier = 4
      }

      if (!apiId) {
        skipped.push(`${player.name} [no_match]`)
        totalSkipped++
        continue
      }

      // ── Find existing squad-sync duplicate ──────────────────────────────
      const { data: existingLinked, error: dupErr } = await supabase
        .from('players')
        .select('id, name')
        .eq('api_id', apiId)
        .maybeSingle()

      if (dupErr) {
        // Multiple rows with same api_id — skip safely
        skipped.push(`${player.name} [dup_conflict:${dupErr.code}]`)
        totalSkipped++
        continue
      }

      if (existingLinked) {
        // ── MERGE: Wikipedia duplicate → squad-sync player ──────────────
        // 1. Enrich squad-sync player with Wikipedia full name + age + club
        const enrichment: Record<string, any> = { name: player.name }
        if ((player as any).age  != null) enrichment.age  = (player as any).age
        if ((player as any).club != null) enrichment.club = (player as any).club
        await supabase.from('players').update(enrichment).eq('id', existingLinked.id)

        // 2. Transfer scorer_picks: Wikipedia player → squad-sync player
        await supabase
          .from('scorer_picks')
          .update({ player_id: existingLinked.id })
          .eq('player_id', player.id)

        // 3. Transfer favourite_player_id: Wikipedia player → squad-sync player
        await supabase
          .from('profiles')
          .update({ favourite_player_id: existingLinked.id })
          .eq('favourite_player_id', player.id)

        // 4. Transfer goal_events: Wikipedia player → squad-sync player
        await supabase
          .from('goal_events')
          .update({ player_id: existingLinked.id })
          .eq('player_id', player.id)

        // 5. Delete the now-orphaned Wikipedia record
        const { error: delErr } = await supabase
          .from('players')
          .delete()
          .eq('id', player.id)

        if (!delErr) {
          teamResolved++; totalResolved++
        } else {
          // Still blocked by some FK — revert name and report
          await supabase.from('players').update({ name: existingLinked.name }).eq('id', existingLinked.id)
          skipped.push(`${player.name} [del:${delErr.code}]`)
          totalSkipped++
        }

      } else {
        // ── DIRECT LINK: no duplicate, just set api_id ──────────────────
        const { error } = await supabase
          .from('players')
          .update({ api_id: apiId })
          .eq('id', player.id)
        if (!error) {
          teamResolved++; totalResolved++
        } else {
          skipped.push(`${player.name} [link:${error.code}]`)
          totalSkipped++
        }
      }
    }

    if (teamResolved > 0 || skipped.length > 0) {
      report.push({ team: team.name, apiSquadSize: apiPlayers.length, resolved: teamResolved, skipped })
    }
  }

  return NextResponse.json({
    message: `Resolved ${totalResolved} players. ${totalSkipped} could not be matched.`,
    totalResolved,
    totalSkipped,
    report,
  })
}
