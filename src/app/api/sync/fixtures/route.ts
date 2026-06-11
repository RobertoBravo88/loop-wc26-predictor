import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchFixtures, mapStatus } from '@/lib/api-football/client'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST() {
  const supabase = createServiceClient()

  try {
    const fixtures = await fetchFixtures(2026)
    let upserted = 0

    for (const f of fixtures) {
      const [{ data: homeTeam }, { data: awayTeam }] = await Promise.all([
        supabase.from('teams').select('id, group_letter').eq('api_id', f.teams.home.id).single(),
        supabase.from('teams').select('id, group_letter').eq('api_id', f.teams.away.id).single(),
      ])

      const groupLetter = parseGroup(f.league.round)
        ?? homeTeam?.group_letter
        ?? awayTeam?.group_letter
        ?? null

      const matchData = {
        api_id:       f.fixture.id,
        stage:        mapApiRound(f.league.round),
        group_letter: groupLetter,
        home_team_id: homeTeam?.id ?? null,
        away_team_id: awayTeam?.id ?? null,
        kickoff_at:   f.fixture.date,
        status:       mapStatus(f.fixture.status.short),
        venue:        f.fixture.venue?.name ?? null,
      }

      // First try to find an existing row by kickoff_at + one of the team IDs
      // (handles the case where rows were imported without api_ids)
      let updated = false
      if (homeTeam?.id || awayTeam?.id) {
        const teamId = homeTeam?.id ?? awayTeam?.id
        const { data: existing } = await supabase
          .from('matches')
          .select('id')
          .eq('kickoff_at', f.fixture.date)
          .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
          .is('api_id', null)
          .maybeSingle()

        if (existing) {
          await supabase.from('matches').update({
            api_id: f.fixture.id,
            status: mapStatus(f.fixture.status.short),
            venue:  f.fixture.venue?.name ?? null,
          }).eq('id', existing.id)
          updated = true
        }
      }

      // If no existing row found, upsert by api_id (normal path)
      if (!updated) {
        await supabase.from('matches').upsert(matchData, { onConflict: 'api_id' })
      }

      upserted++
    }

    return NextResponse.json({ message: `Synced ${upserted} fixtures` })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

function mapApiRound(round: string): string {
  if (round.startsWith('Group')) return 'group'
  if (round.includes('32'))      return 'round_of_32'
  if (round.includes('16'))      return 'round_of_16'
  if (round.includes('Quarter')) return 'quarter_final'
  if (round.includes('Semi'))    return 'semi_final'
  if (round.includes('3rd'))     return 'third_place'
  if (round.includes('Final'))   return 'final'
  return 'group'
}

function parseGroup(round: string): string | null {
  const match = round.match(/^Group ([A-Z])$/i)
  return match ? match[1].toUpperCase() : null
}
