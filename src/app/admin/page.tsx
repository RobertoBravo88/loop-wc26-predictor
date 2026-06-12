import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Users, RefreshCw, FileText, Trophy, Settings } from 'lucide-react'
import AdminSyncButton from '@/components/admin/AdminSyncButton'
import AdminUserTable from '@/components/admin/AdminUserTable'
import AdminNewsSection from '@/components/admin/AdminNewsSection'
import AdminPlayersSection from '@/components/admin/AdminPlayersSection'
import AdminPlayerLinker from '@/components/admin/AdminPlayerLinker'
import AdminApiPlayerLinker from '@/components/admin/AdminApiPlayerLinker'
import AdminMatchCentreSimulator from '@/components/admin/AdminMatchCentreSimulator'
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

  const [unlinkedRes, scorerPicksRes, favPlayerRes, goalEventsRes, playersForLinkerRes, apiPlayersRes] = await Promise.all([
    supabase.from('players').select('id, name, position, team:teams(id, name, flag_url, api_id)').is('api_id', null).order('name').limit(2000),
    supabase.from('scorer_picks').select('player_id'),
    supabase.from('profiles').select('favourite_player_id').not('favourite_player_id', 'is', null),
    supabase.from('goal_events').select('player_id').not('player_id', 'is', null),
    supabase.from('players').select('id, name, position, api_id, team:teams(name, flag_url)').order('name').limit(2000),
    supabase.from('api_players').select('api_id, name, team_id, shirt_number').order('name').limit(2000),
  ])
  const unlinkedPlayers = unlinkedRes.data

  const pickedPlayerIds = new Set([
    ...(scorerPicksRes.data ?? []).map(r => r.player_id).filter(Boolean),
    ...(favPlayerRes.data ?? []).map(r => r.favourite_player_id).filter(Boolean),
  ])
  const scoredPlayerIds = new Set(
    (goalEventsRes.data ?? []).map(r => r.player_id).filter(Boolean)
  )

  // Build api_players lookup map for the linker (api_id → name + shirt)
  const apiPlayersMap = new Map<number, { name: string; shirt_number: number | null }>()
  for (const ap of apiPlayersRes.data ?? []) {
    apiPlayersMap.set(ap.api_id, { name: ap.name, shirt_number: ap.shirt_number })
  }

  // Enrich players with api_player name + shirt for the linker
  const playersForLinker = (playersForLinkerRes.data ?? []).map((p: any) => ({
    id:               p.id,
    name:             p.name,
    position:         p.position ?? null,
    team_id:          (p.team as any)?.id ?? null,
    team_name:        (p.team as any)?.name ?? null,
    team_flag:        (p.team as any)?.flag_url ?? null,
    api_id:           p.api_id ?? null,
    api_player_name:  p.api_id != null ? (apiPlayersMap.get(p.api_id)?.name ?? null) : null,
    api_player_shirt: p.api_id != null ? (apiPlayersMap.get(p.api_id)?.shirt_number ?? null) : null,
  }))

  const apiPlayersForLinker = (apiPlayersRes.data ?? []).map((ap: any) => ({
    api_id:       ap.api_id,
    name:         ap.name,
    team_id:      ap.team_id,
    shirt_number: ap.shirt_number ?? null,
  }))

  const linkedCount   = playersForLinker.filter(p => p.api_id !== null).length
  const apiPlayerCount = apiPlayersRes.data?.length ?? 0

  const { data: matchStats } = await supabase.from('matches').select('status')

  // Matches for the simulator — all matches with teams known
  const { data: simMatches } = await supabase
    .from('matches')
    .select('id, kickoff_at, group_letter, stage, home_team_id, away_team_id, home_team:teams!home_team_id(name), away_team:teams!away_team_id(name)')
    .not('home_team_id', 'is', null)
    .not('away_team_id', 'is', null)
    .order('kickoff_at')

  const simMatchList = (simMatches ?? []).map((m: any) => ({
    id: m.id,
    label: `${m.group_letter ? `Group ${m.group_letter}` : m.stage?.replace(/_/g, ' ')} — ${m.home_team?.name} vs ${m.away_team?.name} (${format(new Date(m.kickoff_at), 'd MMM')})`,
    homeTeamId:   m.home_team_id,
    awayTeamId:   m.away_team_id,
    homeTeamName: m.home_team?.name ?? '?',
    awayTeamName: m.away_team?.name ?? '?',
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

      {/* ── 2. News posts ─────────────────────────────────── */}
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
          <strong>Sync squads</strong> — adds squad players with api_id and shirt numbers from api-football.
        </p>

        {/* Clean player setup sequence */}
        <div className="p-4 mb-1" style={{ background: '#f7f4ef', border: '1px solid #e0dbd3' }}>
          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#141414', fontFamily: sans }}>
            🧹 Clean player setup — run in order
          </p>
          <div className="flex flex-wrap gap-3 mb-2">
            <AdminSyncButton endpoint="/api/admin/import-squads" label="1. Reset & Import WC26 Squads" variant="primary" />
            <AdminSyncButton endpoint="/api/sync/squads"         label="2. Sync squads" batched />
          </div>
          <p className="text-xs" style={{ color: '#6b6b6b', fontFamily: sans }}>
            <strong>Step 1</strong> — wipes all players + picks, imports full names from built-in squad list into the players table.<br />
            <strong>Step 2</strong> — syncs api-football squad data into the separate api_players table (abbreviated names, shirt numbers, photos).<br />
            <strong>Step 3</strong> — use the "Auto-link" button in the Player links section below to match players to api_players.
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

      {/* ── 6. Player ↔ Api player linker ───────────────────────── */}
      <section style={{ background: '#ffffff', border: '1px solid #e0dbd3' }} className="overflow-hidden">
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #e0dbd3' }}>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" style={{ color: '#3b82f6' }} />
            <h2 className="font-bold text-sm uppercase tracking-wider" style={{ color: '#141414', fontFamily: sans }}>
              Player links — {linkedCount} / {playersForLinker.length} linked
            </h2>
          </div>
          <span className="text-xs" style={{ color: '#6b6b6b', fontFamily: sans }}>
            🔴 = picked by a Looper · ⚽ = has scored · {apiPlayerCount} api players available
          </span>
        </div>
        <AdminApiPlayerLinker
          players={playersForLinker}
          apiPlayers={apiPlayersForLinker}
          pickedPlayerIds={[...pickedPlayerIds]}
          scoredPlayerIds={[...scoredPlayerIds]}
        />
      </section>

      {/* ── Match Centre Simulator ────────────────────────── */}
      <section style={{ background: '#ffffff', border: '1px solid #e0dbd3' }} className="overflow-hidden">
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #e0dbd3' }}>
          <div>
            <h2 className="font-bold text-sm uppercase tracking-wider" style={{ color: '#141414', fontFamily: sans }}>
              🎬 Match Centre Simulator
            </h2>
            <p className="text-xs mt-0.5" style={{ color: '#6b6b6b', fontFamily: sans }}>
              Preview the Match Centre card on the home page with simulated live data — only visible to admin.
            </p>
          </div>
        </div>
        <AdminMatchCentreSimulator matches={simMatchList} />
      </section>

    </div>
  )
}
