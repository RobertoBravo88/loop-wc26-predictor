import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function PATCH(request: Request) {
  try {
    const { playerId, apiId } = await request.json()
    if (!playerId || !apiId) {
      return NextResponse.json({ error: 'Missing playerId or apiId' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { error } = await supabase
      .from('players')
      .update({ api_id: Number(apiId) })
      .eq('id', playerId)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
