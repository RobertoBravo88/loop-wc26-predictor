import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatKickoff, isTournamentStarted } from '@/lib/utils'
import { Trophy, ChevronRight } from 'lucide-react'
import type { Match, LeaderboardEntry, NewsPost } from '@/types'

export const revalidate = 60

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: upcomingMatches } = await supabase
    .from('matches')
    .select('*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*)')
    .eq('status', 'scheduled')
    .order('kickoff_at', { ascending: true })
    .limit(5)

  const { data: leaders } = await supabase
    .from('leaderboard')
    .select('*')
    .order('rank', { ascending: true })
    .limit(5)

  const { data: posts } = await supabase
    .from('news_posts')
    .select('*, author:profiles(display_name)')
    .eq('is_published', true)
    .order('published_at', { ascending: false })
    .limit(3)

  const tournamentStarted = isTournamentStarted()

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">

      {/* Hero */}
      <section className="rounded-3xl bg-[#0a0a0a] text-white px-8 py-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 70% 50%, #ff5c35 0%, transparent 60%)' }} />
        <div className="relative max-w-2xl">
          <div className="flex items-center gap-2 text-[#ff5c35] text-sm font-medium mb-3">
            <Trophy className="w-4 h-4" />
            FIFA World Cup 2026
          </div>
          <h1 className="text-4xl font-bold mb-3">Loop WC26 Predictor</h1>
          <p className="text-gray-400 text-lg mb-6">
            Predict every match, earn points, climb the leaderboard. The office is watching.
          </p>
          {!user ? (
            <div className="flex gap-3">
              <Link href="/auth/signup"
                className="bg-[#ff5c35] hover:bg-[#e04a26] text-white px-6 py-2.5 rounded-xl font-semibold transition-colors">
                Join the competition
              </Link>
              <Link href="/auth/login"
                className="border border-white/20 hover:border-white/40 text-white px-6 py-2.5 rounded-xl font-semibold transition-colors">
                Sign in
              </Link>
            </div>
          ) : (
            <div className="flex gap-3">
              <Link href="/predictions"
                className="bg-[#ff5c35] hover:bg-[#e04a26] text-white px-6 py-2.5 rounded-xl font-semibold transition-colors">
                Make predictions →
              </Link>
              {!tournamentStarted && (
                <Link href="/tournament-picks"
                  className="border border-white/20 hover:border-white/40 text-white px-6 py-2.5 rounded-xl font-semibold transition-colors">
                  Set my picks
                </Link>
              )}
            </div>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Leaderboard preview */}
        <div className="lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Leaderboard</h2>
            <Link href="/leaderboard" className="text-sm text-[#ff5c35] hover:underline flex items-center gap-1">
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
            {(leaders as LeaderboardEntry[] ?? []).map((entry, i) => (
              <Link key={entry.id} href={`/profile/${entry.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                <span className={`w-6 text-center text-sm font-bold ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-amber-600' : 'text-gray-400'}`}>
                  {entry.rank}
                </span>
                {entry.favourite_team_flag ? (
                  <img src={entry.favourite_team_flag} alt="" className="w-6 h-4 object-cover rounded-sm flex-shrink-0" />
                ) : (
                  <div className="w-6 h-4 bg-gray-100 rounded-sm flex-shrink-0" />
                )}
                <span className="flex-1 text-sm font-medium text-gray-800 truncate">{entry.display_name}</span>
                {entry.current_streak >= 3 && (
                  <span className="streak-badge text-sm">🔥{entry.current_streak}</span>
                )}
                <span className="text-sm font-bold text-[#ff5c35]">{entry.total_points}</span>
              </Link>
            ))}
            {!leaders?.length && (
              <p className="px-4 py-6 text-sm text-gray-400 text-center">No scores yet — be the first!</p>
            )}
          </div>
        </div>

        {/* Upcoming matches */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Upcoming matches</h2>
            <Link href="/predictions" className="text-sm text-[#ff5c35] hover:underline flex items-center gap-1">
              All predictions <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {(upcomingMatches as Match[] ?? []).map(match => (
              <div key={match.id} className="bg-white rounded-2xl border border-gray-100 px-5 py-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                    {match.group_letter ? `Group ${match.group_letter}` : match.stage.replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs text-gray-400">{formatKickoff(match.kickoff_at)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 flex-1 justify-end">
                    <span className="text-sm font-semibold text-gray-800">{match.home_team?.name ?? '—'}</span>
                    {match.home_team?.flag_url && (
                      <img src={match.home_team.flag_url} alt="" className="w-6 h-4 object-cover rounded-sm" />
                    )}
                  </div>
                  <span className="text-xs font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">vs</span>
                  <div className="flex items-center gap-2 flex-1">
                    {match.away_team?.flag_url && (
                      <img src={match.away_team.flag_url} alt="" className="w-6 h-4 object-cover rounded-sm" />
                    )}
                    <span className="text-sm font-semibold text-gray-800">{match.away_team?.name ?? '—'}</span>
                  </div>
                </div>
              </div>
            ))}
            {!upcomingMatches?.length && (
              <div className="bg-white rounded-2xl border border-gray-100 px-5 py-8 text-center text-sm text-gray-400">
                Fixtures will appear here once loaded.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* News */}
      {posts && posts.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Latest news</h2>
            <Link href="/news" className="text-sm text-[#ff5c35] hover:underline flex items-center gap-1">
              All posts <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(posts as any[]).map(post => (
              <Link key={post.id} href={`/news/${post.slug}`}
                className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-[#ff5c35]/30 hover:shadow-sm transition-all group">
                {post.image_url && (
                  <img src={post.image_url} alt={post.title} className="w-full h-32 object-cover rounded-xl mb-4" />
                )}
                <h3 className="font-semibold text-gray-900 group-hover:text-[#ff5c35] transition-colors text-sm leading-snug mb-1">
                  {post.title}
                </h3>
                {post.excerpt && <p className="text-xs text-gray-500 line-clamp-2">{post.excerpt}</p>}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
