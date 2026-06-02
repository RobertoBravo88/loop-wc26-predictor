import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const caller = await createClient()
  const { data: { user } } = await caller.auth.getUser()
  if (!user) return null
  const { data: p } = await caller.from('profiles').select('role').eq('id', user.id).single()
  return p?.role === 'admin' ? user : null
}

// POST — save / activate a simulation
export async function POST(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { matchId, homeScore, awayScore, state, goalEvents } = await req.json()
  if (!matchId) return NextResponse.json({ error: 'matchId required' }, { status: 400 })

  const supabase = createServiceClient()
  // Delete any existing preview, then insert new one
  await supabase.from('match_centre_preview').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('match_centre_preview').insert({
    match_id:    matchId,
    home_score:  homeScore ?? 0,
    away_score:  awayScore ?? 0,
    state:       state ?? 'live',
    goal_events: goalEvents ?? [],
  })

  return NextResponse.json({ success: true })
}

// DELETE — clear the simulation
export async function DELETE() {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const supabase = createServiceClient()
  await supabase.from('match_centre_preview').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  return NextResponse.json({ success: true })
}
