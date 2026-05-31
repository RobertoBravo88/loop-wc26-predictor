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
      const { data: homeTeam } = await supabase.from('teams').select('id').eq('api_id', f.teams.home.id).single()
      const { data: awayTeam } = await supabase.from('teams').select('id').eq('api_id', f.teams.away.id).single()

      await supabase.from('matches').upsert({
        api_id:       f.fixture.id,
        stage:        mapApiRound(f.league.round),
        group_letter: parseGroup(f.league.round),
        home_team_id: homeTeam?.id ?? null,
        away_team_id: awayTeam?.id ?? null,
        kickoff_at:   f.fixture.date,
        status:       mapStatus(f.fixture.status.short),
        venue:        f.fixture.venue?.name ?? null,
        home_score:   f.goals.home,
        away_score:   f.goals.away,
      }, { onConflict: 'api_id' })

      upserted++
    }

    return NextResponse.json({ message: `Synced ${upserted} fixtures` })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

function mapApiRound(round: string): string {
  if (round.startsWith('Group')) return 'group'
  if (round.includes('32')) return 'round_of_32'
  if (round.includes('Quarter')) return 'quarter_final'
  if (round.includes('Semi')) return 'semi_final'
  if (round.includes('3rd')) return 'third_place'
  if (round.includes('Final')) return 'final'
  return 'group'
}

function parseGroup(round: string): string | null {
  const match = round.match(/Group (\w)/)
  return match ? match[1] : null
}
