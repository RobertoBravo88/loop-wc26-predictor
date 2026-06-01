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
  { href: '/groups',       label: 'Tournament'  },
  { href: '/news',         label: 'News'        },
  { href: '/stats',        label: 'Stats'       },
  { href: '/how-to-play',  label: 'How to Play' },
]

export default function Navbar({ profile, pendingPredictions = 0 }: { profile: Profile | null; pendingPredictions?: number }) {
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
    <header className="sticky top-0 z-50" style={{ background: '#141414', overflow: 'visible' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14" style={{ overflow: 'visible' }}>

          {/* Logo + flag badge */}
          <div className="flex items-center gap-4" style={{ overflow: 'visible' }}>
            <Link
              href="/"
              className="text-white text-xl tracking-tight"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 900 }}
            >
              Loop WC26
            </Link>

            {/* Flag — hangs below navbar, links to team page */}
            {profile?.favourite_team?.flag_url && (
              <Link
                href={`/teams/${(profile.favourite_team as any).id}`}
                className="hidden md:block flex-shrink-0"
                style={{ overflow: 'visible', lineHeight: 0 }}
              >
                <img
                  src={profile.favourite_team.flag_url}
                  alt={profile.favourite_team.name ?? ''}
                  style={{
                    height: '68px',
                    width: 'auto',
                    objectFit: 'contain',
                    display: 'block',
                    transform: 'translateY(12px)',
                  }}
                />
              </Link>
            )}
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-0">
            {NAV_LINKS.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium transition-colors uppercase tracking-wider flex items-center gap-1.5',
                  pathname === link.href
                    ? 'text-white border-b-2'
                    : 'text-gray-400 hover:text-white'
                )}
                style={pathname === link.href ? { borderBottomColor: '#ff5c35' } : {}}
              >
                {link.label}
                {link.href === '/predictions' && pendingPredictions > 0 && (
                  <span
                    className="text-white text-xs font-bold px-1.5 py-0.5 leading-none"
                    style={{ background: '#ff5c35', minWidth: '18px', textAlign: 'center' }}
                  >
                    {pendingPredictions}
                  </span>
                )}
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
                'flex items-center gap-2 px-3 py-2 text-xs font-medium uppercase tracking-wider transition-colors',
                pathname === link.href
                  ? 'text-white'
                  : 'text-gray-400 hover:text-white'
              )}
              style={pathname === link.href ? { borderLeft: '2px solid #ff5c35', paddingLeft: '10px' } : {}}
            >
              {link.label}
              {link.href === '/predictions' && pendingPredictions > 0 && (
                <span
                  className="text-white text-xs font-bold px-1.5 py-0.5 leading-none"
                  style={{ background: '#ff5c35', minWidth: '18px', textAlign: 'center' }}
                >
                  {pendingPredictions}
                </span>
              )}
            </Link>
          ))}
          {profile?.role === 'admin' && (
            <Link
              href="/admin"
              onClick={() => setMenuOpen(false)}
              className={cn(
                'block px-3 py-2 text-xs font-medium uppercase tracking-wider transition-colors',
                pathname.startsWith('/admin') ? 'text-white' : 'text-gray-400 hover:text-white'
              )}
              style={pathname.startsWith('/admin') ? { borderLeft: '2px solid #ff5c35', paddingLeft: '10px' } : {}}
            >
              Admin
            </Link>
          )}
          {profile && (
            <>
              <Link
                href={`/profile/${profile.id}`}
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2 text-xs font-medium uppercase tracking-wider text-gray-300 hover:text-white transition-colors"
              >
                My profile
              </Link>
              <button
                onClick={handleLogout}
                className="block w-full text-left px-3 py-2 text-xs font-medium uppercase tracking-wider text-gray-500 hover:text-white transition-colors"
              >
                Log out
              </button>
            </>
          )}
        </div>
      )}
    </header>
  )
}
