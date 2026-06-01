import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchFixtures, mapStatus } from '@/lib/api-football/client'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST() {
  const supabase = createServiceClient()

  try {
    // (C2) fetchFixtures now paginates automatically via getAll
    // (M8) fetchFixtures throws a descriptive error if result is empty
    const fixtures = await fetchFixtures(2026)
    let upserted = 0

    for (const f of fixtures) {
      // Fetch both teams including their group_letter (used as fallback when
      // api-football uses "Group Stage - X" format instead of "Group D")
      const [{ data: homeTeam }, { data: awayTeam }] = await Promise.all([
        supabase.from('teams').select('id, group_letter').eq('api_id', f.teams.home.id).single(),
        supabase.from('teams').select('id, group_letter').eq('api_id', f.teams.away.id).single(),
      ])

      const groupLetter = parseGroup(f.league.round)
        ?? homeTeam?.group_letter      // fall back to team's own group
        ?? awayTeam?.group_letter
        ?? null

      // (M3) Do NOT write home_score / away_score here — those are owned by the cron sync-results job
      await supabase.from('matches').upsert({
        api_id:       f.fixture.id,
        stage:        mapApiRound(f.league.round),
        group_letter: groupLetter,
        home_team_id: homeTeam?.id ?? null,
        away_team_id: awayTeam?.id ?? null,
        kickoff_at:   f.fixture.date,
        status:       mapStatus(f.fixture.status.short),
        venue:        f.fixture.venue?.name ?? null,
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
  if (round.includes('32'))      return 'round_of_32'
  if (round.includes('16'))      return 'round_of_16'
  if (round.includes('Quarter')) return 'quarter_final'
  if (round.includes('Semi'))    return 'semi_final'
  if (round.includes('3rd'))     return 'third_place'
  if (round.includes('Final'))   return 'final'
  return 'group'
}

function parseGroup(round: string): string | null {
  // Match "Group A", "Group B" etc. but NOT "Group Stage" (which would
  // incorrectly return "S" — the first char of "Stage")
  const match = round.match(/^Group ([A-Z])$/i)
  return match ? match[1].toUpperCase() : null
}
