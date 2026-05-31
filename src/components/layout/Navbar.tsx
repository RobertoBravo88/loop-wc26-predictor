'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { Menu, X, LogOut, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { Profile } from '@/types'

const NAV_LINKS = [
  { href: '/',             label: 'Home'        },
  { href: '/predictions',  label: 'Predictions' },
  { href: '/leaderboard',  label: 'Leaderboard' },
  { href: '/groups',       label: 'Groups'      },
  { href: '/bracket',      label: 'Bracket'     },
  { href: '/news',         label: 'News'        },
  { href: '/stats',        label: 'Stats'       },
  { href: '/how-to-play',  label: 'How to Play' },
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
    <header className="sticky top-0 z-50" style={{ background: '#141414' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">

          {/* Logo */}
          <Link
            href="/"
            className="text-white text-xl tracking-tight"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 900 }}
          >
            Loop WC26
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-0">
            {NAV_LINKS.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium transition-colors uppercase tracking-wider',
                  pathname === link.href
                    ? 'text-white border-b-2'
                    : 'text-gray-400 hover:text-white'
                )}
                style={pathname === link.href ? { borderBottomColor: '#ff5c35' } : {}}
              >
                {link.label}
              </Link>
            ))}
            {profile?.role === 'admin' && (
              <Link
                href="/admin"
                className={cn(
                  'px-3 py-1.5 text-xs font-medium transition-colors uppercase tracking-wider',
                  pathname.startsWith('/admin')
                    ? 'text-white border-b-2'
                    : 'text-gray-400 hover:text-white'
                )}
                style={pathname.startsWith('/admin') ? { borderBottomColor: '#ff5c35' } : {}}
              >
                Admin
              </Link>
            )}
          </nav>

          {/* Desktop user menu */}
          <div className="hidden md:flex items-center gap-4">
            {profile && (
              <>
                {profile.favourite_team?.flag_url && (
                  <img
                    src={profile.favourite_team.flag_url}
                    alt={profile.favourite_team.name}
                    className="w-6 h-4 object-cover flex-shrink-0"
                  />
                )}
                <Link
                  href={`/profile/${profile.id}`}
                  className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white transition-colors uppercase tracking-wider"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>{profile.display_name}</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 text-gray-400 hover:text-white transition-colors"
            onClick={() => setMenuOpen(v => !v)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t px-4 py-3 space-y-0.5" style={{ borderColor: '#2a2a2a', background: '#141414' }}>
          {NAV_LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className={cn(
                'block px-3 py-2 text-xs font-medium uppercase tracking-wider transition-colors',
                pathname === link.href
                  ? 'text-white'
                  : 'text-gray-400 hover:text-white'
              )}
              style={pathname === link.href ? { borderLeft: '2px solid #ff5c35', paddingLeft: '10px' } : {}}
            >
              {link.label}
            </Link>
          ))}
          {profile?.role === 'admin' && (
            <Link href="/admin" onClick={() => setMenuOpen(false)}
              className="block px-3 py-2 text-xs font-medium uppercase tracking-wider text-gray-400 hover:text-white">
              Admin
            </Link>
          )}
          {profile && (
            <button
              onClick={handleLogout}
              className="block w-full text-left px-3 py-2 text-xs font-medium uppercase tracking-wider text-gray-500 hover:text-white transition-colors"
            >
              Log out
            </button>
          )}
        </div>
      )}
    </header>
  )
}
