import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ── Auth guard helper ────────────────────────────────────────────
async function requireAdmin(): Promise<boolean> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    return profile?.role === 'admin'
  } catch {
    return false
  }
}

// ── PATCH — set players.api_id = apiPlayerApiId ──────────────────
export async function PATCH(req: NextRequest) {
  if (!await requireAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { playerId, apiPlayerApiId } = await req.json()
    if (!playerId || !apiPlayerApiId) {
      return NextResponse.json({ error: 'Missing playerId or apiPlayerApiId' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Get the api_player data to copy over
    const { data: apiPlayer } = await supabase
      .from('api_players')
      .select('shirt_number, photo_url')
      .eq('api_id', Number(apiPlayerApiId))
      .maybeSingle()

    const { error } = await supabase.from('players').update({
      api_id:       Number(apiPlayerApiId),
      shirt_number: apiPlayer?.shirt_number ?? null,
      photo_url:    apiPlayer?.photo_url ?? null,
    }).eq('id', playerId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── DELETE — unlink: set players.api_id = NULL ───────────────────
export async function DELETE(req: NextRequest) {
  if (!await requireAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { playerId } = await req.json()
    if (!playerId) {
      return NextResponse.json({ error: 'Missing playerId' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const { error } = await supabase.from('players').update({
      api_id: null,
    }).eq('id', playerId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
