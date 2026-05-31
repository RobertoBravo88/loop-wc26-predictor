import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { LeaderboardEntry } from '@/types'

export const revalidate = 60

export default async function LeaderboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: entries } = await supabase
    .from('leaderboard')
    .select('*')
    .order('rank', { ascending: true })

  const leaderboard = (entries ?? []) as LeaderboardEntry[]

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Leaderboard</h1>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-12 px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
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
            <Link key={entry.id} href={`/profile/${entry.id}`}
              className={`grid grid-cols-12 px-4 py-3 items-center border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors ${isMe ? 'bg-[#ff5c35]/5' : ''}`}>

              {/* Rank */}
              <span className="col-span-1 text-center text-sm font-bold text-gray-400">
                {medal ?? entry.rank}
              </span>

              {/* Player */}
              <div className="col-span-5 flex items-center gap-2 min-w-0">
                {entry.favourite_team_flag ? (
                  <img src={entry.favourite_team_flag} alt="" className="w-6 h-4 object-cover rounded-sm flex-shrink-0" />
                ) : (
                  <div className="w-6 h-4 bg-gray-100 rounded-sm flex-shrink-0" />
                )}
                <span className={`text-sm font-medium truncate ${isMe ? 'text-[#ff5c35]' : 'text-gray-800'}`}>
                  {entry.display_name}
                  {isMe && <span className="ml-1 text-xs">(you)</span>}
                </span>
                {entry.current_streak >= 3 && (
                  <span className="streak-badge text-xs flex-shrink-0">🔥{entry.current_streak}</span>
                )}
              </div>

              {/* Predicted */}
              <span className="col-span-2 text-center text-sm text-gray-500">{entry.matches_predicted}</span>

              {/* Exact */}
              <span className="col-span-2 text-center text-sm text-gray-500">{entry.exact_scores}</span>

              {/* Points */}
              <span className={`col-span-2 text-right text-sm font-bold ${isMe ? 'text-[#ff5c35]' : 'text-gray-800'}`}>
                {entry.total_points}
              </span>
            </Link>
          )
        })}

        {!leaderboard.length && (
          <div className="px-4 py-12 text-center text-sm text-gray-400">
            The competition hasn&apos;t started yet. Get your predictions in!
          </div>
        )}
      </div>
    </div>
  )
}
