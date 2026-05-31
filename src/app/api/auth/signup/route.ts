import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

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

  // ── Step 1: Sign up via the normal auth flow so Supabase sends the confirmation email ──
  const authClient = await createClient()
  const { data: { user }, error: signUpError } = await authClient.auth.signUp({
    email,
    password,
    options: {
      data: { display_name },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/login`,
    },
  })

  if (signUpError || !user) {
    return NextResponse.json(
      { error: signUpError?.message ?? 'Signup failed' },
      { status: 400 }
    )
  }

  // ── Step 2: Use service client for privileged DB writes ──
  const supabase = createServiceClient()

  // Update profile (created automatically by DB trigger on user insert)
  await supabase
    .from('profiles')
    .update({
      display_name,
      favourite_team_id:   favourite_team_id   || null,
      favourite_player_id: favourite_player_id || null,
    })
    .eq('id', user.id)

  // Save finalist picks if provided
  if (first_team_id || second_team_id || third_team_id) {
    await supabase.from('finalist_picks').upsert(
      {
        user_id:         user.id,
        first_team_id:   first_team_id   || null,
        second_team_id:  second_team_id  || null,
        third_team_id:   third_team_id   || null,
      },
      { onConflict: 'user_id' }
    )
  }

  // Save scorer picks
  if (scorer_picks && Object.keys(scorer_picks).length > 0) {
    const rows = Object.entries(scorer_picks as Record<string, string>)
      .filter(([, playerId]) => !!playerId)
      .map(([teamId, playerId]) => ({
        user_id:   user.id,
        team_id:   teamId,
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
