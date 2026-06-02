import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Users, RefreshCw, FileText, Trophy, Settings } from 'lucide-react'
import AdminSyncButton from '@/components/admin/AdminSyncButton'
import AdminUserTable from '@/components/admin/AdminUserTable'
import AdminNewsSection from '@/components/admin/AdminNewsSection'
import AdminPlayersSection from '@/components/admin/AdminPlayersSection'
import AdminPlayerLinker from '@/components/admin/AdminPlayerLinker'
import AdminMatchSimulator from '@/components/admin/AdminMatchSimulator'
import { format } from 'date-fns'

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
    .limit(2000)

  const [unlinkedRes, scorerPicksRes, favPlayerRes, goalEventsRes] = await Promise.all([
    supabase.from('players').select('id, name, position, team:teams(id, name, flag_url, api_id)').is('api_id', null).order('name').limit(2000),
    supabase.from('scorer_picks').select('player_id'),
    supabase.from('profiles').select('favourite_player_id').not('favourite_player_id', 'is', null),
    supabase.from('goal_events').select('player_id').not('player_id', 'is', null),
  ])
  const unlinkedPlayers = unlinkedRes.data

  const pickedPlayerIds = new Set([
    ...(scorerPicksRes.data ?? []).map(r => r.player_id).filter(Boolean),
    ...(favPlayerRes.data ?? []).map(r => r.favourite_player_id).filter(Boolean),
  ])
  const scoredPlayerIds = new Set(
    (goalEventsRes.data ?? []).map(r => r.player_id).filter(Boolean)
  )

  const { data: matchStats } = await supabase.from('matches').select('status')

  // Matches for the simulator — all matches with teams known
  const { data: simMatches } = await supabase
    .from('matches')
    .select('id, kickoff_at, group_letter, stage, home_team:teams!home_team_id(name), away_team:teams!away_team_id(name)')
    .not('home_team_id', 'is', null)
    .not('away_team_id', 'is', null)
    .order('kickoff_at')

  const simMatchList = (simMatches ?? []).map((m: any) => ({
    id: m.id,
    label: `${m.group_letter ? `Group ${m.group_letter}` : m.stage?.replace(/_/g, ' ')} — ${m.home_team?.name} vs ${m.away_team?.name} (${format(new Date(m.kickoff_at), 'd MMM')})`,
  }))

  const simDate = process.env.NEXT_PUBLIC_SIMULATION_DATE
  const totalMatches     = matchStats?.length ?? 0
  const finishedMatches  = matchStats?.filter(m => m.status === 'finished').length ?? 0
  const scheduledMatches = matchStats?.filter(m => m.status === 'scheduled').length ?? 0

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">

      {/* Page header */}
      <div className="mb-2 pb-3" style={{ borderBottom: '2px solid #141414' }}>
        <div className="flex items-center justify-between">
          <h1 className="text-4xl" style={{ fontFamily: serif, fontWeight: 900, color: '#141414' }}>
            Admin
          </h1>
          <span className="text-xs font-semibold uppercase tracking-wider px-3 py-1" style={{ background: '#ff5c35', color: '#ffffff', fontFamily: sans }}>
            Admin
          </span>
        </div>
      </div>

      {/* ── Simulation mode banner ────────────────────────── */}
      {simDate && (
        <div
          className="px-5 py-3 flex items-center gap-3 text-sm font-semibold"
          style={{ background: '#fef9c3', border: '1px solid #eab308', color: '#92400e', fontFamily: sans }}
        >
          <span>⏰ Simulation mode active</span>
          <span className="font-normal" style={{ color: '#a16207' }}>
            "Now" is set to <strong>{format(new Date(simDate), 'd MMM yyyy · HH:mm')}</strong> via NEXT_PUBLIC_SIMULATION_DATE env var. Remove it to return to real time.
          </span>
        </div>
      )}

      {/* ── 1. Overview cards ─────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Loopers',       value: userCount ?? 0,  icon: Users,    color: '#3b82f6' },
          { label: 'Total matches', value: totalMatches,     icon: Trophy,   color: '#eab308' },
          { label: 'Finished',      value: finishedMatches,  icon: Trophy,   color: '#22c55e' },
          { label: 'Upcoming',      value: scheduledMatches, icon: Settings, color: '#6b6b6b' },
        ].map(card => (
          <div key={card.label} className="p-4" style={{ background: '#ffffff', border: '1px solid #e0dbd3' }}>
            <card.icon className="w-4 h-4 mb-2" style={{ color: card.color }} />
            <div className="text-2xl font-bold mb-0.5" style={{ color: '#141414', fontFamily: sans }}>{card.value}</div>
            <div className="text-xs uppercase tracking-wider" style={{ color: '#6b6b6b', fontFamily: sans }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* ── 2. Match simulator ───────────────────────────── */}
      <section style={{ background: '#ffffff', border: '1px solid #e0dbd3' }} className="overflow-hidden">
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #e0dbd3' }}>
          <div>
            <h2 className="font-bold text-sm uppercase tracking-wider" style={{ color: '#141414', fontFamily: sans }}>
              ⏰ Match Simulator
            </h2>
            <p className="text-xs mt-0.5" style={{ color: '#6b6b6b', fontFamily: sans }}>
              Dry run — pick any match, enter a hypothetical score, see who earns what. No data is written.
            </p>
          </div>
        </div>
        <AdminMatchSimulator matches={simMatchList} />
      </section>

      {/* ── 3. News posts ─────────────────────────────────── */}
      <section style={{ background: '#ffffff', border: '1px solid #e0dbd3' }} className="overflow-hidden">
        <div className="px-6 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid #e0dbd3' }}>
          <FileText className="w-4 h-4" style={{ color: '#6b6b6b' }} />
          <h2 className="font-bold text-sm uppercase tracking-wider" style={{ color: '#141414', fontFamily: sans }}>
            News posts
          </h2>
        </div>
        <AdminNewsSection authorId={user.id} posts={(recentPosts ?? []) as any} />
      </section>

      {/* ── 3. Loopers ────────────────────────────────────── */}
      <section style={{ background: '#ffffff', border: '1px solid #e0dbd3' }} className="overflow-hidden">
        <div className="px-6 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid #e0dbd3' }}>
          <Users className="w-4 h-4" style={{ color: '#6b6b6b' }} />
          <h2 className="font-bold text-sm uppercase tracking-wider" style={{ color: '#141414', fontFamily: sans }}>
            Loopers ({userCount ?? 0})
          </h2>
        </div>
        <AdminUserTable users={users ?? []} />
      </section>

      {/* ── 4. Sync & maintenance ────────────────────────── */}
      <section style={{ background: '#ffffff', border: '1px solid #e0dbd3' }} className="p-6">
        <h2 className="font-bold mb-4 flex items-center gap-2 text-sm uppercase tracking-wider" style={{ color: '#141414', fontFamily: sans }}>
          <RefreshCw className="w-4 h-4" style={{ color: '#ff5c35' }} /> Data sync
        </h2>

        {/* During the tournament — most used */}
        <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#141414', fontFamily: sans }}>
          During the tournament
        </p>
        <div className="flex flex-wrap gap-3 mb-5">
          <AdminSyncButton endpoint="/api/sync/results"      label="Sync results now"              variant="primary" />
          <AdminSyncButton endpoint="/api/sync/players-wc"   label="Sync WC players (from Jun 11)" batched />
          <AdminSyncButton endpoint="/api/admin/reprocess-goal-bonuses" label="Reprocess goal bonuses" variant="primary" />
        </div>
        <p className="text-xs mb-5" style={{ color: '#6b6b6b', fontFamily: sans }}>
          <strong>Sync results now</strong> — manually trigger the result cron. Runs automatically every 10 min.<br />
          <strong>Sync WC players</strong> — once matches start, syncs players from actual WC stats. Run daily from June 11.<br />
          <strong>Reprocess goal bonuses</strong> — re-awards any missed scorer / 12th Man bonuses. Safe to run anytime, especially after linking players.
        </p>

        {/* Pre-tournament setup */}
        <p className="text-xs font-semibold uppercase tracking-wider mb-2 pt-4" style={{ color: '#141414', fontFamily: sans, borderTop: '1px solid #e0dbd3', paddingTop: '1rem' }}>
          Pre-tournament setup (run once)
        </p>
        <div className="flex flex-wrap gap-3 mb-3">
          <AdminSyncButton endpoint="/api/sync/teams"    label="Sync team IDs" />
          <AdminSyncButton endpoint="/api/sync/fixtures" label="Sync fixtures" />
          <AdminSyncButton endpoint="/api/sync/squads"   label="Sync squads" batched />
        </div>
        <p className="text-xs mb-4" style={{ color: '#6b6b6b', fontFamily: sans }}>
          <strong>Sync team IDs</strong> — links our teams to api-football IDs. Run once at setup.<br />
          <strong>Sync fixtures</strong> — imports all 104 match schedules from api-football.<br />
          <strong>Sync squads</strong> — enriches players with shirt numbers and photos from api-football.
        </p>
        <div className="flex flex-wrap items-center gap-3" style={{ borderTop: '1px solid #f0ede8', paddingTop: '0.75rem' }}>
          <AdminSyncButton endpoint="/api/admin/import-squads" label="⚠️ Reset & Import WC26 Squads" variant="primary" />
          <p className="text-xs" style={{ color: '#6b6b6b', fontFamily: sans }}>
            Wipes all players and squad picks, then reimports from the built-in WC 2026 squad list. Run once before the tournament to reset dirty data.
          </p>
        </div>

        {/* Diagnostics */}
        <p className="text-xs font-semibold uppercase tracking-wider mb-2 pt-4" style={{ color: '#141414', fontFamily: sans, borderTop: '1px solid #e0dbd3', paddingTop: '1rem' }}>
          Diagnostics
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <AdminSyncButton endpoint="/api/admin/find-league" label="Test fixtures API" />
          <p className="text-xs" style={{ color: '#6b6b6b', fontFamily: sans }}>
            Tests whether the api-football fixtures endpoint is returning data. Use if Sync fixtures returns 0 results.
          </p>
        </div>
      </section>

      {/* ── 5. Squad players ─────────────────────────────── */}
      <section style={{ background: '#ffffff', border: '1px solid #e0dbd3' }} className="overflow-hidden">
        <div className="px-6 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid #e0dbd3' }}>
          <Users className="w-4 h-4" style={{ color: '#6b6b6b' }} />
          <h2 className="font-bold text-sm uppercase tracking-wider" style={{ color: '#141414', fontFamily: sans }}>
            Squad players ({allPlayers?.length ?? 0})
          </h2>
        </div>
        <AdminPlayersSection players={(allPlayers ?? []) as any} />
      </section>

      {/* ── 6. Unlinked players ───────────────────────────── */}
      <section style={{ background: '#ffffff', border: '1px solid #e0dbd3' }} className="overflow-hidden">
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #e0dbd3' }}>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" style={{ color: '#ff5c35' }} />
            <h2 className="font-bold text-sm uppercase tracking-wider" style={{ color: '#141414', fontFamily: sans }}>
              Unlinked players ({unlinkedPlayers?.length ?? 0})
            </h2>
          </div>
          <span className="text-xs" style={{ color: '#6b6b6b', fontFamily: sans }}>
            🔴 = picked by a Looper · ⚽ = has scored a goal — link these first
          </span>
        </div>
        <AdminPlayerLinker
          players={(unlinkedPlayers ?? []) as any}
          pickedPlayerIds={[...pickedPlayerIds]}
          scoredPlayerIds={[...scoredPlayerIds]}
        />
      </section>

    </div>
  )
}
