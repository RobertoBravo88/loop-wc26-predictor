import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { format } from 'date-fns'
import { isTournamentStarted } from '@/lib/utils'
import type { LeaderboardEntry } from '@/types'

export const revalidate = 60

export default async function LeaderboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [entriesRes, lastSyncRes, shirtsRes] = await Promise.all([
    supabase.from('leaderboard').select('*').order('rank', { ascending: true }),
    supabase.from('matches').select('result_fetched_at').not('result_fetched_at', 'is', null).order('result_fetched_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('profiles').select('id, favourite_player:players(shirt_number)'),
  ])

  const leaderboard       = (entriesRes.data ?? []) as LeaderboardEntry[]
  const lastSynced        = lastSyncRes.data?.result_fetched_at ?? null
  const tournamentStarted = isTournamentStarted()

  // Build shirt number lookup: userId → shirt_number
  const shirtMap = new Map<string, number | null>()
  for (const p of shirtsRes.data ?? []) {
    const shirt = (p as any).favourite_player?.shirt_number ?? null
    shirtMap.set(p.id, shirt)
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">

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
            ? `Last updated · ${format(new Date(lastSynced), 'd MMM · HH:mm')}`
            : 'No results synced yet'}
        </p>
      </div>

      {/* Newspaper-style rankings table */}
      <div style={{ border: '1px solid #e0dbd3' }}>
        {/* Header */}
        <div
          className="grid grid-cols-12 px-4 py-2 text-xs font-semibold uppercase tracking-wider"
          style={{ background: '#141414', color: '#ffffff', fontFamily: 'Inter, sans-serif', borderBottom: '1px solid #e0dbd3' }}
        >
          <span className="col-span-1 text-center">#</span>
          <span className="col-span-5">Player</span>
          <span className="col-span-2 text-center">Predicted</span>
          <span className="col-span-2 text-center">Exact</span>
          <span className="col-span-2 text-right">Points</span>
        </div>

        {leaderboard.map((entry, i) => {
          const isMe = entry.id === user?.id
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null

          return (
            <Link
              key={entry.id}
              href={`/profile/${entry.id}`}
              className="grid grid-cols-12 px-4 py-3 items-center transition-colors hover:opacity-80"
              style={{
                background: isMe
                  ? 'rgba(255, 92, 53, 0.04)'
                  : i % 2 === 0 ? '#ffffff' : '#faf9f6',
                borderBottom: '1px solid #e0dbd3',
                borderLeft: isMe ? '3px solid #ff5c35' : '3px solid transparent'
              }}
            >
              {/* Rank */}
              <span
                className="col-span-1 text-center text-sm font-bold"
                style={{ fontFamily: 'Inter, sans-serif', color: '#6b6b6b' }}
              >
                {medal ?? entry.rank}
              </span>

              {/* Player */}
              <div className="col-span-5 flex items-center gap-2 min-w-0">
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
                    fontWeight: isMe ? 600 : 400
                  }}
                >
                  {entry.display_name}
                  {isMe && <span className="ml-1 text-xs" style={{ color: '#6b6b6b' }}>(you)</span>}
                </span>
                {entry.current_streak >= 3 && (
                  <span className="streak-badge text-xs flex-shrink-0">🔥{entry.current_streak}</span>
                )}
              </div>

              {/* Predicted */}
              <span
                className="col-span-2 text-center text-sm"
                style={{ fontFamily: 'Inter, sans-serif', color: '#6b6b6b' }}
              >
                {entry.matches_predicted}
              </span>

              {/* Exact */}
              <span
                className="col-span-2 text-center text-sm"
                style={{ fontFamily: 'Inter, sans-serif', color: '#6b6b6b' }}
              >
                {entry.exact_scores}
              </span>

              {/* Points */}
              <span
                className="col-span-2 text-right text-sm font-bold"
                style={{ fontFamily: 'Inter, sans-serif', color: '#ff5c35' }}
              >
                {entry.total_points}
              </span>
            </Link>
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
