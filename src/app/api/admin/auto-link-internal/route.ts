import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic    = 'force-dynamic'
export const maxDuration = 300

/**
 * DB-to-DB auto-link — no API calls needed.
 *
 * Matches text-file players (api_id = null, full names like "Brian Brobbey")
 * against squad-sync players (api_id set, abbreviated names like "B. Brobbey")
 * within the same team using the same 4-tier name normalisation.
 *
 * On match: enriches the squad-sync player with the full name/position/club
 * from the text-file player, transfers all scorer_picks + favourite_player_id
 * + goal_events references, then deletes the now-redundant text-file record.
 *
 * Run after: Reset & Import WC26 Squads → Sync squads → this button.
 */

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/ø/g, 'o').replace(/ð/g, 'd').replace(/þ/g, 'th')
    .replace(/æ/g, 'ae').replace(/ß/g, 'ss').replace(/ł/g, 'l')
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z\s'-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function POST() {
  const supabase = createServiceClient()

  // All teams
  const { data: teams } = await supabase.from('teams').select('id, name')

  let totalMerged  = 0
  let totalSkipped = 0
  const report: Array<{ team: string; merged: string[]; skipped: string[] }> = []

  for (const team of teams ?? []) {
    // Unlinked players (text file import)
    const { data: unlinked } = await supabase
      .from('players')
      .select('id, name, position, club')
      .eq('team_id', team.id)
      .is('api_id', null)

    // Linked players (squad sync — have api_id and abbreviated names)
    const { data: linked } = await supabase
      .from('players')
      .select('id, name, api_id')
      .eq('team_id', team.id)
      .not('api_id', 'is', null)

    if (!unlinked?.length || !linked?.length) continue

    // Build lookup maps from squad-sync (abbreviated) names
    const byExact          = new Map<string, { id: string; apiId: number }>()
    const lastCount        = new Map<string, number>()
    const byLast           = new Map<string, { id: string; apiId: number }>()
    const byInitialSurname = new Map<string, { id: string; apiId: number }>()
    const initialCollisions = new Set<string>()

    for (const lp of linked) {
      const n     = norm(lp.name)
      const words = n.split(' ')
      const last  = words[words.length - 1]

      byExact.set(n, { id: lp.id, apiId: lp.api_id as number })
      lastCount.set(last, (lastCount.get(last) ?? 0) + 1)
      byLast.set(last, { id: lp.id, apiId: lp.api_id as number })

      if (words.length >= 2 && words[0].length === 1) {
        const key = `${words[0]}.${last}`
        if (byInitialSurname.has(key)) {
          initialCollisions.add(key)
        } else {
          byInitialSurname.set(key, { id: lp.id, apiId: lp.api_id as number })
        }
      }
    }

    const merged:  string[] = []
    const skipped: string[] = []

    for (const up of unlinked) {
      const n     = norm(up.name)
      const words = n.split(' ')
      const last  = words[words.length - 1]
      const first = words[0] ?? ''

      // Tier 1: exact normalised name
      let match = byExact.get(n) ?? null

      // Tier 2: unique surname
      if (!match && (lastCount.get(last) ?? 0) === 1) {
        match = byLast.get(last) ?? null
      }

      // Tier 3: first initial + surname ("Brian Brobbey" → "b.brobbey")
      if (!match && first.length > 0) {
        const key = `${first[0]}.${last}`
        if (!initialCollisions.has(key)) {
          match = byInitialSurname.get(key) ?? null
        }
      }

      // Tier 4: reversed ("Park Jin-seob" ↔ "J. Park")
      if (!match && words.length >= 2 && last.length > 0) {
        const key = `${last[0]}.${first}`
        if (!initialCollisions.has(key)) {
          match = byInitialSurname.get(key) ?? null
        }
      }

      if (!match) {
        skipped.push(`${up.name} [no_match]`)
        totalSkipped++
        continue
      }

      // ── Merge: update squad-sync player with full name/position/club ──
      const originalName = linked.find((l: any) => l.id === match.id)?.name ?? ''
      const enrichment: Record<string, any> = { name: up.name }
      if (up.position) enrichment.position = up.position
      if (up.club)     enrichment.club      = up.club
      await supabase.from('players').update(enrichment).eq('id', match.id)

      // Transfer scorer_picks
      await supabase.from('scorer_picks').update({ player_id: match.id }).eq('player_id', up.id)

      // Transfer favourite_player_id
      await supabase.from('profiles').update({ favourite_player_id: match.id }).eq('favourite_player_id', up.id)

      // Transfer goal_events
      await supabase.from('goal_events').update({ player_id: match.id }).eq('player_id', up.id)

      // Delete the text-file duplicate
      const { error: delErr } = await supabase.from('players').delete().eq('id', up.id)
      if (delErr) {
        // Revert on failure
        await supabase.from('scorer_picks').update({ player_id: up.id }).eq('player_id', match.id)
        await supabase.from('profiles').update({ favourite_player_id: up.id }).eq('favourite_player_id', match.id)
        await supabase.from('goal_events').update({ player_id: up.id }).eq('player_id', match.id)
        await supabase.from('players').update({ name: originalName }).eq('id', match.id)
        skipped.push(`${up.name} [del_failed:${delErr.code}]`)
        totalSkipped++
      } else {
        merged.push(up.name)
        totalMerged++
      }
    }

    if (merged.length || skipped.length) {
      report.push({ team: team.name, merged, skipped })
    }
  }

  return NextResponse.json({
    message: `Merged ${totalMerged} players. ${totalSkipped} could not be matched.`,
    totalMerged,
    totalSkipped,
    report,
  })
}
