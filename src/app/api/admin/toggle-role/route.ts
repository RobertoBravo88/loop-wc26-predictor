import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  // Verify the caller is an admin
  const caller = await createClient()
  const { data: { user } } = await caller.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: callerProfile } = await caller.from('profiles').select('role').eq('id', user.id).single()
  if (callerProfile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId, currentRole } = await req.json()
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

  // Prevent self-demotion
  if (userId === user.id) return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 })

  const newRole = currentRole === 'admin' ? 'player' : 'admin'

  // Use service client to bypass RLS — admins can't update other users' profiles via client
  const service = createServiceClient()
  const { error } = await service.from('profiles').update({ role: newRole }).eq('id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, newRole })
}
