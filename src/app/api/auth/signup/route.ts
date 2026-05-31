import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    display_name,
    email,
    password,
    favourite_team_id,
    favourite_player_id,
    first_team_id,
    second_team_id,
    third_team_id,
    scorer_picks,
  } = body

  const supabase = createServiceClient()

  // 1. Create user via admin API (sends confirmation email if enabled in Supabase project)
  const {
    data: { user },
    error: signUpError,
  } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
    user_metadata: { display_name },
  })

  if (signUpError || !user) {
    return NextResponse.json(
      { error: signUpError?.message ?? 'Signup failed' },
      { status: 400 }
    )
  }

  // 2. Update profile row (the trigger already created it on user creation)
  await supabase
    .from('profiles')
    .update({
      display_name,
      favourite_team_id: favourite_team_id || null,
      favourite_player_id: favourite_player_id || null,
    })
    .eq('id', user.id)

  // 3. Save finalist picks if any were provided
  if (first_team_id || second_team_id || third_team_id) {
    await supabase.from('finalist_picks').upsert(
      {
        user_id: user.id,
        first_team_id: first_team_id || null,
        second_team_id: second_team_id || null,
        third_team_id: third_team_id || null,
      },
      { onConflict: 'user_id' }
    )
  }

  // 4. Save scorer picks (one per team)
  if (scorer_picks && Object.keys(scorer_picks).length > 0) {
    const rows = Object.entries(scorer_picks as Record<string, string>)
      .filter(([, playerId]) => !!playerId)
      .map(([teamId, playerId]) => ({
        user_id: user.id,
        team_id: teamId,
        player_id: playerId,
      }))

    if (rows.length > 0) {
      await supabase
        .from('scorer_picks')
        .upsert(rows, { onConflict: 'user_id,team_id' })
    }
  }

  return NextResponse.json({ success: true })
}
