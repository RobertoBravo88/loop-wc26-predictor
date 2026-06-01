import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { reprocessGoalBonuses } from '@/lib/points/engine'

export const dynamic    = 'force-dynamic'
export const maxDuration = 300

export async function POST() {
  const supabase = createServiceClient()

  // Reprocess all finished matches
  const { data: matches } = await supabase
    .from('matches')
    .select('id')
    .eq('status', 'finished')

  if (!matches?.length) {
    return NextResponse.json({ message: 'No finished matches to reprocess', bonusesAwarded: 0 })
  }

  let totalBonuses = 0
  const errors: string[] = []

  for (const match of matches) {
    try {
      const { bonusesAwarded } = await reprocessGoalBonuses(match.id)
      totalBonuses += bonusesAwarded
    } catch (err: any) {
      errors.push(`Match ${match.id}: ${err.message}`)
    }
  }

  return NextResponse.json({
    message: `Reprocessed ${matches.length} matches — ${totalBonuses} new bonuses awarded`,
    bonusesAwarded: totalBonuses,
    errors: errors.length ? errors : undefined,
  })
}
