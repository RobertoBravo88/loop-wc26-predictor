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
    const [profileRes, futureMatchRes] = await Promise.all([
      supabase.from('profiles').select('*, favourite_team:teams(*), favourite_player:players(*)').eq('id', user.id).single(),
      supabase.from('matches').select('id').eq('status', 'scheduled').gt('kickoff_at', new Date().toISOString()),
    ])
    profile = profileRes.data

    const futureIds = (futureMatchRes.data ?? []).map((m: { id: string }) => m.id)
    if (futureIds.length > 0) {
      const { count: predicted } = await supabase
        .from('predictions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .in('match_id', futureIds)
      pendingPredictions = futureIds.length - (predicted ?? 0)
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
