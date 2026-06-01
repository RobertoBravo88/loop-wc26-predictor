import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchWCPlayersPage } from '@/lib/api-football/client'

// Syncs players from WC 2026 match statistics — only players who actually
// appeared in a WC fixture will be returned. Run this from June 11 onwards
// to replace the pre-tournament squad data with accurate tournament participants.
// The api_ids from this endpoint match exactly what goal events use, so
// scorer picks and favourite player bonuses will always link correctly.

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(request: Request) {
  const supabase = createServiceClient()

  try {
    const { searchParams } = new URL(request.url)
    const offset    = parseInt(searchParams.get('offset') ?? '0', 10)
    const batchSize = parseInt(searchParams.get('batch')  ?? '8', 10)

    const { data: allTeams } = await supabase
      .from('teams')
      .select('id, api_id, name')
      .not('api_id', 'is', null)
      .order('name')

    const teams = (allTeams ?? []).slice(offset, offset + batchSize)
    let totalPlayers = 0
    const errors: string[] = []

    for (const team of teams) {
      try {
        // (N6) Use fetchWCPlayersPage which returns real paging data via { players, hasMore }
        let page = 1
        let teamTotal = 0
        while (true) {
          const { players: pageData, hasMore } = await fetchWCPlayersPage(team.api_id!, 2026, page)
          if (!pageData || pageData.length === 0) break

          for (const entry of pageData) {
            // /players response wraps each item as { player: {...}, statistics: [...] }
            const p = entry.player ?? entry
            if (!p?.id) continue

            await supabase.from('players').upsert({
              api_id:    p.id,
              name:      p.name,
              team_id:   team.id,
              photo_url: p.photo ?? null,
            }, { onConflict: 'api_id' })
            teamTotal++
          }

          if (!hasMore) break // last page according to real paging data
          page++
        }
        totalPlayers += teamTotal
      } catch (teamErr: any) {
        errors.push(`${team.name}: ${teamErr.message}`)
      }
    }

    const total      = allTeams?.length ?? 0
    const nextOffset = offset + batchSize
    const hasMore    = nextOffset < total

    return NextResponse.json({
      message: `Synced ${totalPlayers} WC players (teams ${offset + 1}–${Math.min(offset + batchSize, total)} of ${total})${hasMore ? ` — run again with offset=${nextOffset} for next batch` : ' — all done!'}`,
      errors,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
