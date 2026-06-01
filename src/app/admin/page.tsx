import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Users, RefreshCw, FileText, Trophy, Settings } from 'lucide-react'
import AdminSyncButton from '@/components/admin/AdminSyncButton'
import AdminUserTable from '@/components/admin/AdminUserTable'
import AdminNewsSection from '@/components/admin/AdminNewsSection'
import AdminFinalistProcessor from '@/components/admin/AdminFinalistProcessor'
import AdminPlayersSection from '@/components/admin/AdminPlayersSection'
import AdminPlayerLinker from '@/components/admin/AdminPlayerLinker'
import AdminManagerEditor from '@/components/admin/AdminManagerEditor'

const serif = "'Playfair Display', Georgia, serif"
const sans  = 'Inter, sans-serif'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  const { data: users, count: userCount } = await supabase
    .from('profiles')
    .select('*, favourite_team:teams(name, flag_url)', { count: 'exact' })
    .order('total_points', { ascending: false })

  const { data: recentPosts } = await supabase
    .from('news_posts')
    .select('id, title, excerpt, body, image_url, is_published, published_at, slug')
    .order('created_at', { ascending: false })
    .limit(20)

  const { data: allTeams } = await supabase
    .from('teams')
    .select('*, manager')
    .order('group_letter, name')

  const { data: allPlayers } = await supabase
    .from('players')
    .select('*, team:teams(name, flag_url)')
    .order('name')

  const { data: unlinkedPlayers } = await supabase
    .from('players')
    .select('id, name, position, team:teams(id, name, flag_url, api_id)')
    .is('api_id', null)
    .order('name')

  const { data: matchStats } = await supabase
    .from('matches')
    .select('status')

  const totalMatches     = matchStats?.length ?? 0
  const finishedMatches  = matchStats?.filter(m => m.status === 'finished').length ?? 0
  const scheduledMatches = matchStats?.filter(m => m.status === 'scheduled').length ?? 0

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">

      {/* Page header */}
      <div className="mb-2 pb-3" style={{ borderBottom: '2px solid #141414' }}>
        <div className="flex items-center justify-between">
          <h1
            className="text-4xl"
            style={{ fontFamily: serif, fontWeight: 900, color: '#141414' }}
          >
            Admin
          </h1>
          <span
            className="text-xs font-semibold uppercase tracking-wider px-3 py-1"
            style={{ background: '#ff5c35', color: '#ffffff', fontFamily: sans }}
          >
            Admin
          </span>
        </div>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Players',       value: userCount ?? 0,    icon: Users,    color: '#3b82f6' },
          { label: 'Total matches', value: totalMatches,       icon: Trophy,   color: '#eab308' },
          { label: 'Finished',      value: finishedMatches,    icon: Trophy,   color: '#22c55e' },
          { label: 'Upcoming',      value: scheduledMatches,   icon: Settings, color: '#6b6b6b' },
        ].map(card => (
          <div
            key={card.label}
            className="p-4"
            style={{ background: '#ffffff', border: '1px solid #e0dbd3' }}
          >
            <card.icon className="w-4 h-4 mb-2" style={{ color: card.color }} />
            <div
              className="text-2xl font-bold mb-0.5"
              style={{ color: '#141414', fontFamily: sans }}
            >
              {card.value}
            </div>
            <div
              className="text-xs uppercase tracking-wider"
              style={{ color: '#6b6b6b', fontFamily: sans }}
            >
              {card.label}
            </div>
          </div>
        ))}
      </div>

      {/* Sync controls */}
      <section style={{ background: '#ffffff', border: '1px solid #e0dbd3' }} className="p-6">
        <h2
          className="font-bold mb-1 flex items-center gap-2 text-sm uppercase tracking-wider"
          style={{ color: '#141414', fontFamily: sans }}
        >
          <RefreshCw className="w-4 h-4" style={{ color: '#ff5c35' }} /> Data sync
        </h2>
        <p className="text-sm mb-4" style={{ color: '#6b6b6b', fontFamily: sans }}>
          The cron job auto-syncs at midnight. Use manual sync if something looks off.
        </p>
        <div className="flex flex-wrap gap-3">
          <AdminSyncButton endpoint="/api/sync/teams"    label="Sync team IDs" />
          <AdminSyncButton endpoint="/api/sync/squads"   label="Sync squads" batched />
          <AdminSyncButton endpoint="/api/sync/fixtures" label="Sync fixtures" />
          <AdminSyncButton endpoint="/api/sync/results"  label="Sync results now" variant="primary" />
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-3 pt-3" style={{ borderTop: '1px solid #e0dbd3' }}>
          <AdminSyncButton endpoint="/api/sync/players-wikipedia" label="Import from Wikipedia" />
          <AdminSyncButton endpoint="/api/sync/players-wc" label="Sync WC players (from Jun 11)" batched />
          <p className="text-xs" style={{ color: '#6b6b6b', fontFamily: sans }}>
            Import pulls the official 48 squads from Wikipedia. After importing, use the linker below to connect players to their API id.
          </p>
        </div>
      </section>

      {/* Manager editor */}
      <section style={{ background: '#ffffff', border: '1px solid #e0dbd3' }} className="overflow-hidden">
        <div className="px-6 py-4" style={{ borderBottom: '1px solid #e0dbd3' }}>
          <h2 className="font-bold text-sm uppercase tracking-wider" style={{ color: '#141414', fontFamily: sans }}>
            Team Managers
          </h2>
        </div>
        <AdminManagerEditor teams={(allTeams ?? []) as any} />
      </section>

      {/* Finalist picks processor */}
      <AdminFinalistProcessor teams={allTeams ?? []} />

      {/* Users */}
      <section style={{ background: '#ffffff', border: '1px solid #e0dbd3' }} className="overflow-hidden">
        <div
          className="px-6 py-4 flex items-center gap-2"
          style={{ borderBottom: '1px solid #e0dbd3' }}
        >
          <Users className="w-4 h-4" style={{ color: '#6b6b6b' }} />
          <h2
            className="font-bold text-sm uppercase tracking-wider"
            style={{ color: '#141414', fontFamily: sans }}
          >
            Players ({userCount ?? 0})
          </h2>
        </div>
        <AdminUserTable users={users ?? []} />
      </section>

      {/* Unlinked players */}
      <section style={{ background: '#ffffff', border: '1px solid #e0dbd3' }} className="overflow-hidden">
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: '1px solid #e0dbd3' }}
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" style={{ color: '#ff5c35' }} />
            <h2 className="font-bold text-sm uppercase tracking-wider" style={{ color: '#141414', fontFamily: sans }}>
              Unlinked players ({unlinkedPlayers?.length ?? 0})
            </h2>
          </div>
          <span className="text-xs" style={{ color: '#6b6b6b', fontFamily: sans }}>
            No API id — search &amp; link to connect to goal events
          </span>
        </div>
        <AdminPlayerLinker players={(unlinkedPlayers ?? []) as any} />
      </section>

      {/* Players */}
      <section style={{ background: '#ffffff', border: '1px solid #e0dbd3' }} className="overflow-hidden">
        <div
          className="px-6 py-4 flex items-center gap-2"
          style={{ borderBottom: '1px solid #e0dbd3' }}
        >
          <Users className="w-4 h-4" style={{ color: '#6b6b6b' }} />
          <h2
            className="font-bold text-sm uppercase tracking-wider"
            style={{ color: '#141414', fontFamily: sans }}
          >
            Players ({allPlayers?.length ?? 0})
          </h2>
        </div>
        <AdminPlayersSection players={(allPlayers ?? []) as any} />
      </section>

      {/* News management */}
      <section style={{ background: '#ffffff', border: '1px solid #e0dbd3' }} className="overflow-hidden">
        <div
          className="px-6 py-4 flex items-center gap-2"
          style={{ borderBottom: '1px solid #e0dbd3' }}
        >
          <FileText className="w-4 h-4" style={{ color: '#6b6b6b' }} />
          <h2
            className="font-bold text-sm uppercase tracking-wider"
            style={{ color: '#141414', fontFamily: sans }}
          >
            News posts
          </h2>
        </div>
        <AdminNewsSection
          authorId={user.id}
          posts={(recentPosts ?? []) as any}
        />
      </section>
    </div>
  )
}
