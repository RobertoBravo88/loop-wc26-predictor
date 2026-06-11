import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { isTournamentStarted } from '@/lib/utils'
import LocalTime from '@/components/ui/LocalTime'
import DailyUpdateTime from '@/components/ui/DailyUpdateTime'
import type { LeaderboardEntry } from '@/types'
import BadgeDisplay from '@/components/ui/BadgeDisplay'

export const revalidate = 60

// Grid layout — 12 columns total
// Desktop (sm+): #(1) Looper(3) Pred(1) Pred.pts(2) Streak(2) Bonus(2) Total(1)  = 12
// Mobile:        #(1) Looper(5) [hidden] Pred.pts(2) [hidden] [hidden] Total(4)   = 12
const ROW_CLASS = 'grid grid-cols-12 px-4'

export default async function LeaderboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [entriesRes, lastSyncRes, shirtsRes] = await Promise.all([
    supabase.from('leaderboard').select('*').order('rank', { ascending: true }),
    supabase.from('matches').select('result_fetched_at').not('result_fetched_at', 'is', null).order('result_fetched_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('profiles').select('id, favourite_player:players(shirt_number)'),
  ])

  // Fetch badges separately — fail silently if table doesn't exist yet
  let badgesData: Array<{ user_id: string; badge_id: string; earned_at: string }> | null = null
  try {
    const badgesRes = await supabase.from('user_badges').select('user_id, badge_id, earned_at')
    badgesData = badgesRes.data
  } catch {
    // Table may not exist yet — skip badges
  }

  const leaderboard       = (entriesRes.data ?? []) as LeaderboardEntry[]
  const lastSynced        = lastSyncRes.data?.result_fetched_at ?? null
  const tournamentStarted = isTournamentStarted()

  // Build shirt number lookup: userId → shirt_number
  const shirtMap = new Map<string, number | null>()
  for (const p of shirtsRes.data ?? []) {
    const shirt = (p as any).favourite_player?.shirt_number ?? null
    shirtMap.set(p.id, shirt)
  }

  // Build badge lookup: userId → badges[]
  const badgeMap = new Map<string, Array<{ badge_id: string; earned_at: string }>>()
  for (const b of badgesData ?? []) {
    if (!badgeMap.has(b.user_id)) badgeMap.set(b.user_id, [])
    badgeMap.get(b.user_id)!.push({ badge_id: b.badge_id, earned_at: b.earned_at })
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

      {/* Page header */}
      <div className="mb-8 pb-3" style={{ borderBottom: '2px solid #141414' }}>
        <h1
          className="text-4xl mb-1"
          style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 900, color: '#141414' }}
        >
          Leaderboard
        </h1>
        <p className="text-xs uppercase tracking-wider" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
          {lastSynced
            ? <>Last updated · <LocalTime date={lastSynced} fmt="d MMM · HH:mm" /></>
            : 'No results synced yet'}
        </p>
        <p className="text-xs uppercase tracking-wider mt-0.5" style={{ color: '#9ca3af', fontFamily: 'Inter, sans-serif' }}>
          Daily updates at <DailyUpdateTime />
        </p>
      </div>

      {/* Points legend — 3 columns matching the 3 scoring groups */}
      <div className="mb-6 p-4" style={{ border: '1px solid #e0dbd3', background: '#ffffff' }}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}>
          How points are earned
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">

          {/* Prediction points */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}>
              Prediction pts
            </p>
            {[
              { label: 'Exact score',     pts: '100 pts' },
              { label: 'Correct outcome', pts: '50 pts'  },
            ].map(({ label, pts }) => (
              <div key={label} className="flex items-center justify-between gap-4 mb-1">
                <span className="text-xs" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>{label}</span>
                <span className="text-xs font-bold flex-shrink-0" style={{ color: '#ff5c35', fontFamily: 'Inter, sans-serif' }}>{pts}</span>
              </div>
            ))}
          </div>

          {/* Hot streak */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}>
              🔥 Hot streak
            </p>
            <div className="flex items-center justify-between gap-4 mb-1">
              <span className="text-xs" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>3rd+ exact score in a row</span>
              <span className="text-xs font-bold flex-shrink-0" style={{ color: '#ff5c35', fontFamily: 'Inter, sans-serif' }}>+50 pts each</span>
            </div>
            <p className="text-xs mt-1.5" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
              Your active streak shows next to your name.
            </p>
          </div>

          {/* Bonus points */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}>
              Bonus pts
            </p>
            {[
              { label: '🔮 Crystal Ball — winner',    pts: '300 pts' },
              { label: '🔮 Crystal Ball — runner-up', pts: '200 pts' },
              { label: '🔮 Crystal Ball — 3rd place', pts: '100 pts' },
              { label: '👟 Golden Boots — per goal',  pts: '+10 pts' },
              { label: '⭐ 12th Man — team goal',     pts: '+10 pts' },
              { label: '⭐ 12th Man — player goal',   pts: '+20 pts' },
            ].map(({ label, pts }) => (
              <div key={label} className="flex items-center justify-between gap-4 mb-1">
                <span className="text-xs" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>{label}</span>
                <span className="text-xs font-bold flex-shrink-0" style={{ color: '#ff5c35', fontFamily: 'Inter, sans-serif' }}>{pts}</span>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* Rankings table */}
      <div style={{ border: '1px solid #e0dbd3' }}>

        {/* Header row */}
        <div
          className="flex items-center py-2 text-xs font-semibold uppercase tracking-wider"
          style={{ background: '#141414', color: '#ffffff', fontFamily: 'Inter, sans-serif', borderBottom: '1px solid #e0dbd3' }}
        >
          <div className={`${ROW_CLASS} flex-1 items-center`}>
            <span className="col-span-1 text-center">#</span>
            <span className="col-span-5 sm:col-span-3 flex items-center gap-1.5">
              Looper
              <span className="font-normal normal-case tracking-normal" style={{ color: '#ff5c35' }}>🔥#</span>
            </span>
            <span className="hidden sm:block sm:col-span-1 text-center">Pred.</span>
            <span className="col-span-2 text-center">Pred. pts</span>
            <span className="hidden sm:block sm:col-span-2 text-center">🔥 Streak</span>
            <span className="hidden sm:block sm:col-span-2 text-center">Bonus</span>
            <span className="col-span-4 sm:col-span-1 text-center">Total</span>
          </div>
          {/* H2H column header */}
          <div className="hidden sm:flex items-center justify-center flex-shrink-0" style={{ width: 52 }}>
            <span>H2H</span>
          </div>
        </div>

        {leaderboard.map((entry, i) => {
          const isMe  = entry.id === user?.id
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null
          const streak = entry.current_streak ?? 0

          const rowBg = isMe ? 'rgba(255, 92, 53, 0.04)' : i % 2 === 0 ? '#ffffff' : '#faf9f6'

          return (
            <div
              key={entry.id}
              className="flex items-stretch transition-colors"
              style={{ borderBottom: '1px solid #e0dbd3', background: rowBg, borderLeft: isMe ? '3px solid #ff5c35' : '3px solid transparent' }}
            >
            <Link
              href={`/profile/${entry.id}`}
              className={`${ROW_CLASS} flex-1 py-3 items-center hover:opacity-80`}
              style={{ textDecoration: 'none', background: 'transparent' }}
            >
              {/* Rank */}
              <span
                className="col-span-1 text-center text-sm font-bold"
                style={{ fontFamily: 'Inter, sans-serif', color: '#6b6b6b' }}
              >
                {medal ?? entry.rank}
              </span>

              {/* Looper */}
              <div className="col-span-5 sm:col-span-3 flex items-center gap-2.5 min-w-0">
                {(tournamentStarted || isMe) && entry.favourite_team_flag ? (
                  <img src={entry.favourite_team_flag} alt="" className="w-6 h-4 object-contain flex-shrink-0" />
                ) : (
                  <div className="w-6 h-4 flex-shrink-0" style={{ background: '#f7f4ef' }} />
                )}
                {(tournamentStarted || isMe) && shirtMap.get(entry.id) != null && (
                  <span className="text-xs flex-shrink-0 font-semibold" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
                    #{shirtMap.get(entry.id)}
                  </span>
                )}
                <span
                  className="text-sm truncate"
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    color: isMe ? '#ff5c35' : '#141414',
                    fontWeight: isMe ? 600 : 400,
                  }}
                >
                  {entry.display_name}
                  {isMe && <span className="ml-1 text-xs" style={{ color: '#6b6b6b' }}>(you)</span>}
                </span>

                {/* Streak — 🔥 badge if active (≥3), plain number if warming up (1–2) */}
                {streak >= 3 ? (
                  <span className="streak-badge text-xs flex-shrink-0">🔥{streak}</span>
                ) : streak > 0 ? (
                  <span className="text-xs flex-shrink-0 font-semibold" style={{ color: '#9ca3af', fontFamily: 'Inter, sans-serif' }}>
                    {streak}
                  </span>
                ) : null}

                {/* Badges */}
                {(badgeMap.get(entry.id)?.length ?? 0) > 0 && (
                  <BadgeDisplay
                    badges={badgeMap.get(entry.id)!}
                    userFlagUrl={entry.favourite_team_flag}
                    max={3}
                    size="sm"
                  />
                )}
              </div>

              {/* Predicted — desktop only (match predictions + tournament picks) */}
              <span
                className="hidden sm:block sm:col-span-1 text-center text-sm"
                style={{ fontFamily: 'Inter, sans-serif', color: '#6b6b6b' }}
              >
                {(entry.matches_predicted ?? 0) + (entry.tournament_picks_done ?? 0)}
              </span>

              {/* Prediction points */}
              <span
                className="col-span-2 text-center text-sm"
                style={{ fontFamily: 'Inter, sans-serif', color: '#6b6b6b' }}
              >
                {entry.prediction_points ?? 0}
              </span>

              {/* Streak points — desktop only, orange if non-zero */}
              <span
                className="hidden sm:block sm:col-span-2 text-center text-sm"
                style={{
                  fontFamily: 'Inter, sans-serif',
                  color: (entry.streak_points ?? 0) > 0 ? '#ff5c35' : '#6b6b6b',
                }}
              >
                {entry.streak_points ?? 0}
              </span>

              {/* Bonus points — desktop only, orange if non-zero */}
              <span
                className="hidden sm:block sm:col-span-2 text-center text-sm"
                style={{
                  fontFamily: 'Inter, sans-serif',
                  color: (entry.bonus_points ?? 0) > 0 ? '#ff5c35' : '#6b6b6b',
                }}
              >
                {entry.bonus_points ?? 0}
              </span>

              {/* Total */}
              <span
                className="col-span-4 sm:col-span-1 text-center text-sm font-bold"
                style={{ fontFamily: 'Inter, sans-serif', color: '#ff5c35' }}
              >
                {entry.total_points}
              </span>

            </Link>

            {/* H2H column */}
            <div className="hidden sm:flex items-center justify-center flex-shrink-0" style={{ width: 52 }}>
              {user && !isMe && (
                <Link
                  href={`/compare/${entry.id}`}
                  className="text-xs font-semibold hover:text-[#ff5c35] transition-colors"
                  title={`Compare with ${entry.display_name}`}
                  style={{ color: '#9ca3af', fontFamily: 'Inter, sans-serif', textDecoration: 'none', letterSpacing: '0.03em' }}
                >
                  H2H
                </Link>
              )}
            </div>

            </div>
          )
        })}

        {!leaderboard.length && (
          <div className="px-4 py-12 text-center text-sm" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif', background: '#ffffff' }}>
            Still thinking? Make some noise.
          </div>
        )}
      </div>
    </div>
  )
}
