import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function PATCH(request: Request) {
  try {
    const { teamId, manager } = await request.json()
    if (!teamId) return NextResponse.json({ error: 'Missing teamId' }, { status: 400 })

    const supabase = createServiceClient()
    const { error } = await supabase
      .from('teams')
      .update({ manager: manager || null })
      .eq('id', teamId)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
