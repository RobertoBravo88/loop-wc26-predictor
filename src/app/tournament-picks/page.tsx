import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { isTournamentStarted } from '@/lib/utils'
import TournamentPicksClient from '@/components/predictions/TournamentPicksClient'

export default async function TournamentPicksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const tournamentStarted = isTournamentStarted()

  const { data: teams } = await supabase.from('teams').select('*').order('name')
  const { data: players } = await supabase.from('players').select('*, team:teams(name)').order('name')

  const [finalistPickRes, scorerPicksRes, profileRes] = await Promise.all([
    supabase.from('finalist_picks').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('scorer_picks').select('*, player:players(name, position), team:teams(name, flag_url)').eq('user_id', user.id),
    supabase.from('profiles').select('favourite_team_id, favourite_player_id').eq('id', user.id).maybeSingle(),
  ])

  return (
    <TournamentPicksClient
      userId={user.id}
      teams={teams ?? []}
      players={players ?? []}
      finalistPick={finalistPickRes.data}
      scorerPicks={scorerPicksRes.data ?? []}
      favTeamId={profileRes.data?.favourite_team_id ?? null}
      favPlayerId={profileRes.data?.favourite_player_id ?? null}
      locked={tournamentStarted}
    />
  )
}
