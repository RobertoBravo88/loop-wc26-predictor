import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic    = 'force-dynamic'
export const maxDuration = 300

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
  try {
    const supabase = createServiceClient()

    // ── Load ALL players in 2 bulk queries (not 2 × 48 team queries) ──
    const [{ data: allUnlinked }, { data: allLinked }] = await Promise.all([
      supabase.from('players').select('id, name, position, club, team_id').is('api_id', null),
      supabase.from('players').select('id, name, api_id, team_id').not('api_id', 'is', null),
    ])

    if (!allUnlinked?.length) {
      return NextResponse.json({ message: 'No unlinked players found — nothing to merge.', totalMerged: 0, totalSkipped: 0 })
    }
    if (!allLinked?.length) {
      return NextResponse.json({ message: 'No squad-sync players found — run Sync squads first.', totalMerged: 0, totalSkipped: 0 })
    }

    // Group linked players by team_id
    const linkedByTeam = new Map<string, typeof allLinked>()
    for (const lp of allLinked) {
      if (!linkedByTeam.has(lp.team_id)) linkedByTeam.set(lp.team_id, [])
      linkedByTeam.get(lp.team_id)!.push(lp)
    }

    // ── Build per-team lookup maps and find all matches ──────────────
    type MergeJob = {
      unlinkedId: string
      linkedId: string
      fullName: string
      position: string | null
      club: string | null
      originalLinkedName: string
    }

    const jobs: MergeJob[] = []
    const skipped: string[] = []

    // Group unlinked by team
    const unlinkedByTeam = new Map<string, typeof allUnlinked>()
    for (const up of allUnlinked) {
      if (!unlinkedByTeam.has(up.team_id)) unlinkedByTeam.set(up.team_id, [])
      unlinkedByTeam.get(up.team_id)!.push(up)
    }

    for (const [teamId, unlinked] of unlinkedByTeam) {
      const linked = linkedByTeam.get(teamId)
      if (!linked?.length) {
        for (const up of unlinked) skipped.push(`${up.name} [no_squad_sync_players]`)
        continue
      }

      const byExact           = new Map<string, (typeof linked)[0]>()
      const lastCount         = new Map<string, number>()
      const byLast            = new Map<string, (typeof linked)[0]>()
      const byInitialSurname  = new Map<string, (typeof linked)[0]>()
      const initialCollisions = new Set<string>()

      for (const lp of linked) {
        const n     = norm(lp.name)
        const words = n.split(' ')
        const last  = words[words.length - 1]
        byExact.set(n, lp)
        lastCount.set(last, (lastCount.get(last) ?? 0) + 1)
        byLast.set(last, lp)
        if (words.length >= 2 && words[0].length === 1) {
          const key = `${words[0]}.${last}`
          if (byInitialSurname.has(key)) initialCollisions.add(key)
          else byInitialSurname.set(key, lp)
        }
      }

      for (const up of unlinked) {
        const n     = norm(up.name)
        const words = n.split(' ')
        const last  = words[words.length - 1]
        const first = words[0] ?? ''

        let match = byExact.get(n)
          ?? ((lastCount.get(last) ?? 0) === 1 ? byLast.get(last) : undefined)
          ?? (first.length > 0 && !initialCollisions.has(`${first[0]}.${last}`) ? byInitialSurname.get(`${first[0]}.${last}`) : undefined)
          ?? (words.length >= 2 && !initialCollisions.has(`${last[0]}.${first}`) ? byInitialSurname.get(`${last[0]}.${first}`) : undefined)

        if (!match) { skipped.push(`${up.name} [no_match]`); continue }

        jobs.push({
          unlinkedId:        up.id,
          linkedId:          match.id,
          fullName:          up.name,
          position:          up.position,
          club:              up.club,
          originalLinkedName: match.name,
        })
      }
    }

    // ── Execute merges — parallel transfers per job ──────────────────
    let totalMerged = 0

    for (const job of jobs) {
      // 1. Enrich squad-sync player with full name/position/club
      const enrichment: Record<string, any> = { name: job.fullName }
      if (job.position) enrichment.position = job.position
      if (job.club)     enrichment.club      = job.club
      await supabase.from('players').update(enrichment).eq('id', job.linkedId)

      // 2. Transfer all FK references in parallel
      await Promise.all([
        supabase.from('scorer_picks').update({ player_id: job.linkedId }).eq('player_id', job.unlinkedId),
        supabase.from('profiles').update({ favourite_player_id: job.linkedId }).eq('favourite_player_id', job.unlinkedId),
        supabase.from('goal_events').update({ player_id: job.linkedId }).eq('player_id', job.unlinkedId),
      ])

      // 3. Delete unlinked duplicate
      const { error: delErr } = await supabase.from('players').delete().eq('id', job.unlinkedId)
      if (delErr) {
        // Revert
        await Promise.all([
          supabase.from('scorer_picks').update({ player_id: job.unlinkedId }).eq('player_id', job.linkedId),
          supabase.from('profiles').update({ favourite_player_id: job.unlinkedId }).eq('favourite_player_id', job.linkedId),
          supabase.from('goal_events').update({ player_id: job.unlinkedId }).eq('player_id', job.linkedId),
          supabase.from('players').update({ name: job.originalLinkedName }).eq('id', job.linkedId),
        ])
        skipped.push(`${job.fullName} [del_failed:${delErr.code}]`)
      } else {
        totalMerged++
      }
    }

    return NextResponse.json({
      message: `Merged ${totalMerged} players. ${skipped.length} could not be matched.`,
      totalMerged,
      totalSkipped: skipped.length,
      skipped: skipped.slice(0, 50), // cap report size
    })

  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'Unknown error', message: 'Auto-link failed — see error field' },
      { status: 500 }
    )
  }
}
