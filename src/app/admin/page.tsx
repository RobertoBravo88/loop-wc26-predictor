import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Users, RefreshCw, FileText, Trophy, Settings } from 'lucide-react'
import AdminSyncButton from '@/components/admin/AdminSyncButton'
import AdminUserTable from '@/components/admin/AdminUserTable'
import AdminNewsSection from '@/components/admin/AdminNewsSection'

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

  const { data: matchStats } = await supabase
    .from('matches')
    .select('status')

  const totalMatches = matchStats?.length ?? 0
  const finishedMatches = matchStats?.filter(m => m.status === 'finished').length ?? 0
  const scheduledMatches = matchStats?.filter(m => m.status === 'scheduled').length ?? 0

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
        <span className="text-xs bg-[#ff5c35]/10 text-[#ff5c35] font-semibold px-3 py-1 rounded-full">Admin</span>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Players', value: userCount ?? 0, icon: Users, color: 'text-blue-500' },
          { label: 'Matches total', value: totalMatches, icon: Trophy, color: 'text-yellow-500' },
          { label: 'Finished', value: finishedMatches, icon: Trophy, color: 'text-green-500' },
          { label: 'Upcoming', value: scheduledMatches, icon: Settings, color: 'text-gray-400' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-2xl border border-gray-100 p-4">
            <card.icon className={`w-5 h-5 ${card.color} mb-2`} />
            <div className="text-2xl font-bold text-gray-900">{card.value}</div>
            <div className="text-xs text-gray-400">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Sync controls */}
      <section className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-[#ff5c35]" /> Data sync
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          The cron job auto-syncs after each match. Use manual sync if something looks off.
        </p>
        <div className="flex flex-wrap gap-3">
          <AdminSyncButton endpoint="/api/sync/fixtures" label="Sync fixtures" />
          <AdminSyncButton endpoint="/api/sync/squads" label="Sync squads" />
          <AdminSyncButton endpoint="/api/sync/results" label="Sync results now" variant="primary" />
        </div>
      </section>

      {/* Users */}
      <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Users className="w-4 h-4 text-gray-400" />
          <h2 className="font-bold text-gray-900">Players ({userCount ?? 0})</h2>
        </div>
        <AdminUserTable users={users ?? []} />
      </section>

      {/* News management */}
      <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-400" />
          <h2 className="font-bold text-gray-900">News posts</h2>
        </div>
        <AdminNewsSection
          authorId={user.id}
          posts={(recentPosts ?? []) as any}
        />
      </section>
    </div>
  )
}
