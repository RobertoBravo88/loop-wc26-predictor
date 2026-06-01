import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function DELETE(req: NextRequest) {
  // Auth check — must be a logged-in admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const targetId = req.nextUrl.searchParams.get('id')
  if (!targetId) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  if (targetId === user.id) return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })

  const service = createServiceClient()

  // Delete all dependent data before removing the profile/auth user
  await service.from('predictions').delete().eq('user_id', targetId)
  await service.from('scorer_picks').delete().eq('user_id', targetId)
  await service.from('finalist_picks').delete().eq('user_id', targetId)

  // Delete the profile row
  await service.from('profiles').delete().eq('id', targetId)

  // Delete the auth user (service-role only)
  const { error } = await service.auth.admin.deleteUser(targetId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
