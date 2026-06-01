import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchTeams } from '@/lib/api-football/client'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST() {
  const supabase = createServiceClient()

  try {
    const apiTeams = await fetchTeams(2026)
    const { data: dbTeamsRaw } = await supabase.from('teams').select('id, name, api_id')
    const dbTeams = (dbTeamsRaw ?? []) as Array<{ id: string; name: string; api_id: number | null }>

    if (!dbTeams.length) {
      return NextResponse.json({ error: 'No teams found in database' }, { status: 400 })
    }

    const matched: string[] = []
    const unmatched: string[] = []

    for (const entry of apiTeams) {
      const teamInfo = entry.team as { id: number; name: string }
      const apiId   = teamInfo.id
      const apiName = teamInfo.name

      // Try exact match (case-insensitive)
      let dbTeam = dbTeams.find(t => t.name.toLowerCase() === apiName.toLowerCase())

      // Fallback: partial match (api name is contained in db name or vice versa)
      if (!dbTeam) {
        dbTeam = dbTeams.find(t =>
          t.name.toLowerCase().includes(apiName.toLowerCase()) ||
          apiName.toLowerCase().includes(t.name.toLowerCase())
        )
      }

      if (dbTeam) {
        await supabase.from('teams').update({ api_id: apiId }).eq('id', dbTeam.id)
        matched.push(`${dbTeam.name} → api_id ${apiId}`)
      } else {
        unmatched.push(apiName)
      }
    }

    const unmatchedMsg = unmatched.length
      ? ` | Unmatched: ${unmatched.join(', ')}`
      : ''

    return NextResponse.json({
      message: `Matched ${matched.length} / ${apiTeams.length} teams${unmatchedMsg}`,
      matched,
      unmatched,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
