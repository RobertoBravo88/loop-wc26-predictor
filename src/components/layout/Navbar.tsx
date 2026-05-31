'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { Menu, X, Trophy, LogOut, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { Profile } from '@/types'

const NAV_LINKS = [
  { href: '/',                  label: 'Home'        },
  { href: '/predictions',       label: 'Predictions' },
  { href: '/leaderboard',       label: 'Leaderboard' },
  { href: '/groups',            label: 'Groups'      },
  { href: '/bracket',           label: 'Bracket'     },
  { href: '/tournament-picks',  label: 'My Picks'    },
  { href: '/news',              label: 'News'        },
  { href: '/stats',             label: 'Stats'       },
]

export default function Navbar({ profile }: { profile: Profile | null }) {
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight">
            <Trophy className="w-5 h-5 text-[#ff5c35]" />
            <span>Loop <span className="text-[#ff5c35]">WC26</span></span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  pathname === link.href
                    ? 'bg-[#ff5c35] text-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                )}
              >
                {link.label}
              </Link>
            ))}
            {profile?.role === 'admin' && (
              <Link
                href="/admin"
                className={cn(
                  'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  pathname.startsWith('/admin')
                    ? 'bg-[#ff5c35] text-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                )}
              >
                Admin
              </Link>
            )}
          </nav>

          {/* Desktop user menu */}
          <div className="hidden md:flex items-center gap-3">
            {profile && (
              <>
                {/* Favourite team flag */}
                {profile.favourite_team?.flag_url && (
                  <img
                    src={profile.favourite_team.flag_url}
                    alt={profile.favourite_team.name}
                    className="w-6 h-4 object-cover rounded-sm"
                  />
                )}
                <Link
                  href={`/profile/${profile.id}`}
                  className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900"
                >
                  <User className="w-4 h-4" />
                  <span className="font-medium">{profile.display_name}</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-red-500 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-50"
            onClick={() => setMenuOpen(v => !v)}
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-1">
          {NAV_LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className={cn(
                'block px-3 py-2 rounded-lg text-sm font-medium',
                pathname === link.href
                  ? 'bg-[#ff5c35] text-white'
                  : 'text-gray-700 hover:bg-gray-50'
              )}
            >
              {link.label}
            </Link>
          ))}
          {profile?.role === 'admin' && (
            <Link href="/admin" onClick={() => setMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              Admin
            </Link>
          )}
          {profile && (
            <button
              onClick={handleLogout}
              className="block w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50"
            >
              Log out
            </button>
          )}
        </div>
      )}
    </header>
  )
}
