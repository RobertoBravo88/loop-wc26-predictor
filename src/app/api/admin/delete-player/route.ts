import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = createServiceClient()

  // Block deletion if any user has picked this player
  const { count } = await supabase
    .from('scorer_picks')
    .select('*', { count: 'exact', head: true })
    .eq('player_id', id)

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: `Cannot delete — ${count} user(s) have picked this player` },
      { status: 400 }
    )
  }

  // Also block if it's anyone's favourite player
  const { count: favCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('favourite_player_id', id)

  if ((favCount ?? 0) > 0) {
    return NextResponse.json(
      { error: `Cannot delete — ${favCount} user(s) have this as their secret player` },
      { status: 400 }
    )
  }

  const { error } = await supabase.from('players').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
