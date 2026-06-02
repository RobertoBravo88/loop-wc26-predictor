import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/layout/Navbar'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Loop WC26 Predictor',
  description: 'Predict the 2026 FIFA World Cup and compete with your Loop colleagues.',
  icons: { icon: '/favicon.ico' },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let profile = null
  let pendingPredictions = 0
  if (user) {
    const [profileRes, futureMatchRes, finalistRes, scorerRes] = await Promise.all([
      supabase.from('profiles').select('*, favourite_team:teams(*), favourite_player:players(*)').eq('id', user.id).single(),
      supabase.from('matches').select('id').eq('status', 'scheduled').gt('kickoff_at', new Date().toISOString()),
      supabase.from('finalist_picks').select('first_team_id, second_team_id, third_team_id').eq('user_id', user.id).maybeSingle(),
      supabase.from('scorer_picks').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    ])
    profile = profileRes.data

    // Unfilled match predictions
    const futureIds = (futureMatchRes.data ?? []).map((m: { id: string }) => m.id)
    if (futureIds.length > 0) {
      const { count: predicted } = await supabase
        .from('predictions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .in('match_id', futureIds)
      pendingPredictions = futureIds.length - (predicted ?? 0)
    }

    // Unfilled tournament picks (only before tournament starts — after kick-off they're locked)
    const tournamentStart = new Date(process.env.NEXT_PUBLIC_TOURNAMENT_START ?? '2026-06-11T16:00:00Z')
    const now = process.env.NEXT_PUBLIC_SIMULATION_DATE
      ? new Date(process.env.NEXT_PUBLIC_SIMULATION_DATE)
      : new Date()

    if (now < tournamentStart) {
      const fp = finalistRes.data
      const finalistDone = [fp?.first_team_id, fp?.second_team_id, fp?.third_team_id].filter(Boolean).length
      const scorerDone   = Math.min(scorerRes.count ?? 0, 5)
      const secretsDone  = (profile?.favourite_team_id ? 1 : 0) + (profile?.favourite_player_id ? 1 : 0)
      const tournamentPending = (3 - finalistDone) + (5 - scorerDone) + (2 - secretsDone)
      pendingPredictions += tournamentPending
    }
  }

  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col antialiased" style={{ background: '#f7f4ef', color: '#141414' }}>
        <Navbar profile={profile} pendingPredictions={pendingPredictions} />
        <main className="flex-1">{children}</main>
        <footer className="border-t py-6 text-center text-xs" style={{ borderColor: '#e0dbd3', color: '#6b6b6b' }}>
          Made with 🧡 for the Loop team &middot; WC26
        </footer>
      </body>
    </html>
  )
}
