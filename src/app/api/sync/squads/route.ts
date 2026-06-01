import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchSquad } from '@/lib/api-football/client'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(request: Request) {
  const supabase = createServiceClient()

  try {
    const { searchParams } = new URL(request.url)
    const offset = parseInt(searchParams.get('offset') ?? '0', 10)
    const batchSize = parseInt(searchParams.get('batch') ?? '16', 10)

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
        const squadData = await fetchSquad(team.api_id!)
        const squad = squadData[0]?.players ?? []

        for (const p of squad) {
          await supabase.from('players').upsert({
            api_id:       p.id,
            team_id:      team.id,
            name:         p.name,
            position:     p.position,
            photo_url:    p.photo ?? null,
            shirt_number: p.number ?? null,
          }, { onConflict: 'api_id' })
          totalPlayers++
        }
      } catch (teamErr: any) {
        errors.push(`${team.name}: ${teamErr.message}`)
      }
    }

    const total = allTeams?.length ?? 0
    const nextOffset = offset + batchSize
    const hasMore = nextOffset < total

    return NextResponse.json({
      message: `Synced ${totalPlayers} players (teams ${offset + 1}–${Math.min(offset + batchSize, total)} of ${total})${hasMore ? ` — run again with offset=${nextOffset} for next batch` : ' — all done!'}`,
      errors,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
