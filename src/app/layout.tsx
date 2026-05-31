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
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('*, favourite_team:teams(*), favourite_player:players(*)')
      .eq('id', user.id)
      .single()
    profile = data
  }

  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col antialiased" style={{ background: '#f7f4ef', color: '#141414' }}>
        <Navbar profile={profile} />
        <main className="flex-1">{children}</main>
        <footer className="border-t py-6 text-center text-xs" style={{ borderColor: '#e0dbd3', color: '#6b6b6b' }}>
          Loop WC26 Predictor &middot; {new Date().getFullYear()} &middot; Built for the team
        </footer>
      </body>
    </html>
  )
}
