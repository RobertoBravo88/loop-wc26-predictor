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

  const { data: finalistPick } = await supabase
    .from('finalist_picks')
    .select('*')
    .eq('user_id', user.id)
    .single()

  const { data: scorerPicks } = await supabase
    .from('scorer_picks')
    .select('*, player:players(name, position), team:teams(name, flag_url)')
    .eq('user_id', user.id)

  return (
    <TournamentPicksClient
      userId={user.id}
      teams={teams ?? []}
      players={players ?? []}
      finalistPick={finalistPick}
      scorerPicks={scorerPicks ?? []}
      locked={tournamentStarted}
    />
  )
}
