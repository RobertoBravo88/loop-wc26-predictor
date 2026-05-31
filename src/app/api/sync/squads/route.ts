import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchSquad } from '@/lib/api-football/client'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST() {
  const supabase = createServiceClient()

  try {
    const { data: teams } = await supabase.from('teams').select('id, api_id').not('api_id', 'is', null)
    let totalPlayers = 0

    for (const team of teams ?? []) {
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
    }

    return NextResponse.json({ message: `Synced ${totalPlayers} players across ${teams?.length ?? 0} teams` })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
