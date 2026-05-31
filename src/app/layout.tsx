import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/layout/Navbar'
import { createClient } from '@/lib/supabase/server'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

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
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-white antialiased">
        <Navbar profile={profile} />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-gray-100 py-6 text-center text-xs text-gray-400">
          Loop WC26 Predictor · {new Date().getFullYear()} · Built with ❤️ for the team
        </footer>
      </body>
    </html>
  )
}
