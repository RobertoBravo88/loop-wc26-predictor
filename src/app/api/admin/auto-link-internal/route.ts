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

    // Load all text-file players that are not yet linked
    const { data: allPlayers } = await supabase
      .from('players')
      .select('id, name, team_id')
      .is('api_id', null)

    // Load all api_players
    const { data: allApiPlayers } = await supabase
      .from('api_players')
      .select('api_id, name, team_id, shirt_number, photo_url')

    if (!allPlayers?.length) {
      return NextResponse.json({ message: 'No unlinked players found.', totalLinked: 0 })
    }
    if (!allApiPlayers?.length) {
      return NextResponse.json({ message: 'No api_players found — run Sync squads first.', totalLinked: 0 })
    }

    // Group api_players by team_id
    const apiByTeam = new Map<string, typeof allApiPlayers>()
    for (const ap of allApiPlayers) {
      if (!ap.team_id) continue
      if (!apiByTeam.has(ap.team_id)) apiByTeam.set(ap.team_id, [])
      apiByTeam.get(ap.team_id)!.push(ap)
    }

    // Group players by team_id
    const playersByTeam = new Map<string, typeof allPlayers>()
    for (const p of allPlayers) {
      if (!playersByTeam.has(p.team_id)) playersByTeam.set(p.team_id, [])
      playersByTeam.get(p.team_id)!.push(p)
    }

    let totalLinked = 0
    const skipped: string[] = []

    for (const [teamId, players] of playersByTeam) {
      const apiPlayers = apiByTeam.get(teamId)
      if (!apiPlayers?.length) {
        for (const p of players) skipped.push(`${p.name} [no_api_players_for_team]`)
        continue
      }

      // Build per-team lookup maps (4-tier normalization)
      const byExact           = new Map<string, typeof allApiPlayers[0]>()
      const lastCount         = new Map<string, number>()
      const byLast            = new Map<string, typeof allApiPlayers[0]>()
      const byInitialSurname  = new Map<string, typeof allApiPlayers[0]>()
      const initialCollisions = new Set<string>()

      for (const ap of apiPlayers) {
        const n     = norm(ap.name)
        const words = n.split(' ')
        const last  = words[words.length - 1]
        byExact.set(n, ap)
        lastCount.set(last, (lastCount.get(last) ?? 0) + 1)
        byLast.set(last, ap)
        if (words.length >= 2 && words[0].length === 1) {
          const key = `${words[0]}.${last}`
          if (byInitialSurname.has(key)) initialCollisions.add(key)
          else byInitialSurname.set(key, ap)
        }
      }

      for (const player of players) {
        const n     = norm(player.name)
        const words = n.split(' ')
        const last  = words[words.length - 1]
        const first = words[0] ?? ''

        const match = byExact.get(n)
          ?? ((lastCount.get(last) ?? 0) === 1 ? byLast.get(last) : undefined)
          ?? (first.length > 0 && !initialCollisions.has(`${first[0]}.${last}`) ? byInitialSurname.get(`${first[0]}.${last}`) : undefined)
          ?? (words.length >= 2 && !initialCollisions.has(`${last[0]}.${first}`) ? byInitialSurname.get(`${last[0]}.${first}`) : undefined)

        if (!match) {
          skipped.push(`${player.name} [no_match]`)
          continue
        }

        // Set players.api_id = matched api_player.api_id, and copy shirt_number + photo_url
        const { error: updateErr } = await supabase.from('players').update({
          api_id:       match.api_id,
          shirt_number: match.shirt_number ?? null,
          photo_url:    match.photo_url ?? null,
        }).eq('id', player.id)

        if (updateErr) {
          skipped.push(`${player.name} [update_failed:${updateErr.code}]`)
        } else {
          totalLinked++
        }
      }
    }

    return NextResponse.json({
      message: `Linked ${totalLinked} players. ${skipped.length} could not be matched.`,
      totalLinked,
      skipped: skipped.slice(0, 50),
    })

  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Unknown error' }, { status: 500 })
  }
}
