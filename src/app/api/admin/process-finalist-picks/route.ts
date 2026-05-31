import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { processFinalistPicks } from '@/lib/points/engine'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  // Verify caller is an admin
  const supabase = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { first_team_id, second_team_id, third_team_id } = body

  if (!first_team_id || !second_team_id || !third_team_id) {
    return NextResponse.json(
      { error: 'All three team IDs are required (first, second, third)' },
      { status: 400 }
    )
  }

  try {
    await processFinalistPicks(first_team_id, second_team_id, third_team_id)
    return NextResponse.json({ message: 'Finalist picks processed and points awarded.' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
