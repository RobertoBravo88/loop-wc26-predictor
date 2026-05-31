import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatKickoff, isTournamentStarted } from '@/lib/utils'
import { ChevronRight } from 'lucide-react'
import type { Match, LeaderboardEntry, NewsPost } from '@/types'

export const revalidate = 60

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: upcomingMatches } = await supabase
    .from('matches')
    .select('*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*)')
    .eq('status', 'scheduled')
    .not('home_team_id', 'is', null)
    .not('away_team_id', 'is', null)
    .order('kickoff_at', { ascending: true })
    .limit(5)

  const { data: recentMatches } = await supabase
    .from('matches')
    .select('*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*)')
    .eq('status', 'finished')
    .not('home_team_id', 'is', null)
    .not('away_team_id', 'is', null)
    .order('kickoff_at', { ascending: false })
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

  const matchIds = [...(recentMatches ?? []), ...(upcomingMatches ?? [])].map(m => m.id)
  let predictionMap = new Map<string, { predicted_home: number; predicted_away: number }>()
  if (user && matchIds.length > 0) {
    const { data: preds } = await supabase
      .from('predictions')
      .select('match_id, predicted_home, predicted_away')
      .eq('user_id', user.id)
      .in('match_id', matchIds)
    for (const p of preds ?? []) {
      predictionMap.set(p.match_id, { predicted_home: p.predicted_home, predicted_away: p.predicted_away })
    }
  }

  const tournamentStarted = isTournamentStarted()

  const featuredPost = posts && posts.length > 0 ? (posts as any[])[0] : null
  const remainingPosts = posts && posts.length > 1 ? (posts as any[]).slice(1) : []

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">

      {/* Hero — compact editorial masthead */}
      <section style={{ background: '#141414' }} className="relative overflow-hidden">
        <div className="px-8 py-8 relative">
          <h1
            className="text-3xl sm:text-4xl text-white mb-3 leading-tight"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 900 }}
          >
            Loop WC26<br />Predictor
          </h1>
          <p className="text-sm mb-5 max-w-lg" style={{ color: '#9ca3af', fontFamily: 'Inter, sans-serif' }}>
            Predict every match, earn points, climb the leaderboard. The office is watching.
          </p>
          {!user ? (
            <div className="flex gap-3 flex-wrap">
              <Link
                href="/auth/signup"
                className="px-4 py-2 text-xs font-semibold text-white transition-colors"
                style={{ background: '#ff5c35', fontFamily: 'Inter, sans-serif' }}
              >
                Join the competition
              </Link>
              <Link
                href="/auth/login"
                className="px-4 py-2 text-xs font-semibold text-white border transition-colors hover:border-white/60"
                style={{ borderColor: 'rgba(255,255,255,0.2)', fontFamily: 'Inter, sans-serif' }}
              >
                Sign in
              </Link>
            </div>
          ) : (
            <div className="flex gap-3 flex-wrap">
              <Link
                href="/predictions"
                className="px-4 py-2 text-xs font-semibold text-white transition-colors"
                style={{ background: '#ff5c35', fontFamily: 'Inter, sans-serif' }}
              >
                Make predictions
              </Link>
              {!tournamentStarted && (
                <Link
                  href="/tournament-picks"
                  className="px-4 py-2 text-xs font-semibold text-white border transition-colors hover:border-white/60"
                  style={{ borderColor: 'rgba(255,255,255,0.2)', fontFamily: 'Inter, sans-serif' }}
                >
                  Set my picks
                </Link>
              )}
            </div>
          )}
        </div>
      </section>

      {/* News — featured editorial section */}
      <section>
        <div className="flex items-center justify-between mb-3 pb-3" style={{ borderBottom: '2px solid #141414' }}>
          <h2
            className="text-2xl"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, color: '#141414' }}
          >
            Latest News
          </h2>
          <Link
            href="/news"
            className="text-xs flex items-center gap-1 uppercase tracking-wider hover:opacity-70 transition-opacity"
            style={{ color: '#ff5c35', fontFamily: 'Inter, sans-serif' }}
          >
            All posts <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {featuredPost ? (
          <div className="space-y-0" style={{ border: '1px solid #e0dbd3' }}>
            {/* Featured large card */}
            <Link
              href={`/news/${featuredPost.slug}`}
              className="flex flex-col sm:flex-row group transition-colors hover:opacity-90"
              style={{ background: '#ffffff', borderBottom: remainingPosts.length > 0 ? '1px solid #e0dbd3' : 'none' }}
            >
              {featuredPost.image_url ? (
                <div className="sm:w-1/2 flex-shrink-0">
                  <img
                    src={featuredPost.image_url}
                    alt={featuredPost.title}
                    className="w-full h-48 sm:h-full object-cover"
                    style={{ minHeight: '200px' }}
                  />
                </div>
              ) : (
                <div
                  className="sm:w-1/2 flex-shrink-0 h-48"
                  style={{ background: '#f7f4ef', minHeight: '200px' }}
                />
              )}
              <div className="flex flex-col justify-center p-6 sm:p-8">
                <span
                  className="text-xs uppercase tracking-widest mb-3"
                  style={{ color: '#ff5c35', fontFamily: 'Inter, sans-serif' }}
                >
                  Featured
                </span>
                <h3
                  className="text-2xl sm:text-3xl leading-tight mb-3"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, color: '#141414' }}
                >
                  {featuredPost.title}
                </h3>
                {featuredPost.excerpt && (
                  <p className="text-sm line-clamp-3" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
                    {featuredPost.excerpt}
                  </p>
                )}
                {featuredPost.author?.display_name && (
                  <p className="text-xs mt-4" style={{ color: '#9ca3af', fontFamily: 'Inter, sans-serif' }}>
                    By {featuredPost.author.display_name}
                  </p>
                )}
              </div>
            </Link>

            {/* Remaining smaller cards */}
            {remainingPosts.length > 0 && (
              <div className="grid" style={{ gridTemplateColumns: `repeat(${remainingPosts.length}, 1fr)` }}>
                {remainingPosts.map((post: any, idx: number) => (
                  <Link
                    key={post.id}
                    href={`/news/${post.slug}`}
                    className="p-5 transition-colors hover:opacity-80 group"
                    style={{
                      background: '#faf9f6',
                      borderRight: idx < remainingPosts.length - 1 ? '1px solid #e0dbd3' : 'none'
                    }}
                  >
                    {post.image_url && (
                      <img src={post.image_url} alt={post.title} className="w-full h-24 object-cover mb-3" />
                    )}
                    <h3
                      className="text-sm leading-snug mb-1"
                      style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, color: '#141414' }}
                    >
                      {post.title}
                    </h3>
                    {post.excerpt && (
                      <p className="text-xs line-clamp-2" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
                        {post.excerpt}
                      </p>
                    )}
                    {post.author?.display_name && (
                      <p className="text-xs mt-2" style={{ color: '#9ca3af', fontFamily: 'Inter, sans-serif' }}>
                        By {post.author.display_name}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div
            className="px-8 py-12 text-center"
            style={{ background: '#f7f4ef', border: '1px solid #e0dbd3' }}
          >
            <p
              className="text-lg mb-1"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, color: '#141414' }}
            >
              No stories yet
            </p>
            <p className="text-sm" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
              Editorial coverage will appear here. Check back soon.
            </p>
          </div>
        )}
      </section>

      {/* Leaderboard + Matches grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Leaderboard preview */}
        <div className="lg:col-span-1">
          <div className="flex items-center justify-between mb-3 pb-3" style={{ borderBottom: '1px solid #e0dbd3' }}>
            <h2
              className="text-xl"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, color: '#141414' }}
            >
              Leaderboard
            </h2>
            <Link
              href="/leaderboard"
              className="text-xs flex items-center gap-1 uppercase tracking-wider hover:opacity-70 transition-opacity"
              style={{ color: '#ff5c35', fontFamily: 'Inter, sans-serif' }}
            >
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div style={{ background: '#ffffff', border: '1px solid #e0dbd3' }}>
            {(leaders as LeaderboardEntry[] ?? []).map((entry, i) => (
              <Link key={entry.id} href={`/profile/${entry.id}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:opacity-80"
                style={{ borderBottom: '1px solid #e0dbd3' }}>
                <span
                  className="w-5 text-center text-sm font-bold"
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    color: i === 0 ? '#ca8a04' : i === 1 ? '#9ca3af' : i === 2 ? '#b45309' : '#6b6b6b'
                  }}
                >
                  {entry.rank}
                </span>
                {entry.favourite_team_flag ? (
                  <img src={entry.favourite_team_flag} alt="" className="w-6 h-4 object-cover flex-shrink-0" />
                ) : (
                  <div className="w-6 h-4 flex-shrink-0" style={{ background: '#f7f4ef' }} />
                )}
                <span className="flex-1 text-sm truncate" style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}>
                  {entry.display_name}
                </span>
                {entry.current_streak >= 3 && (
                  <span className="streak-badge text-xs">🔥{entry.current_streak}</span>
                )}
                <span className="text-sm font-bold" style={{ color: '#ff5c35', fontFamily: 'Inter, sans-serif' }}>
                  {entry.total_points}
                </span>
              </Link>
            ))}
            {!leaders?.length && (
              <p className="px-4 py-6 text-sm text-center" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
                No scores yet — be the first!
              </p>
            )}
          </div>
        </div>

        {/* Recent Results + Upcoming Matches stacked */}
        <div className="lg:col-span-2 space-y-8">

          {/* Recent Results — only shown once there are finished matches */}
          {recentMatches && recentMatches.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3 pb-3" style={{ borderBottom: '1px solid #e0dbd3' }}>
                <h2
                  className="text-xl"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, color: '#141414' }}
                >
                  Recent Results
                </h2>
              </div>
              <div style={{ border: '1px solid #e0dbd3' }}>
                {(recentMatches as Match[]).map((match, idx) => {
                  const pred = predictionMap.get(match.id)
                  return (
                    <div
                      key={match.id}
                      className="px-5 py-4"
                      style={{
                        background: idx % 2 === 0 ? '#ffffff' : '#faf9f6',
                        borderBottom: '1px solid #e0dbd3'
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs uppercase tracking-wider" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
                          {match.group_letter ? `Group ${match.group_letter}` : match.stage.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
                          {formatKickoff(match.kickoff_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 flex-1 justify-end">
                          <span className="text-sm font-semibold" style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}>
                            {match.home_team?.name ?? '—'}
                          </span>
                          {match.home_team?.flag_url && (
                            <img src={match.home_team.flag_url} alt="" className="w-6 h-4 object-cover flex-shrink-0" />
                          )}
                        </div>
                        <span
                          className="text-xs font-bold px-2 py-1"
                          style={{ color: '#ffffff', background: '#141414', fontFamily: 'Inter, sans-serif', minWidth: '48px', textAlign: 'center' }}
                        >
                          {match.home_score ?? 0} – {match.away_score ?? 0}
                        </span>
                        <div className="flex items-center gap-2 flex-1">
                          {match.away_team?.flag_url && (
                            <img src={match.away_team.flag_url} alt="" className="w-6 h-4 object-cover flex-shrink-0" />
                          )}
                          <span className="text-sm font-semibold" style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}>
                            {match.away_team?.name ?? '—'}
                          </span>
                        </div>
                      </div>
                      {user && pred && (
                        <div className="mt-2">
                          <span className="text-xs" style={{ color: '#9ca3af', fontFamily: 'Inter, sans-serif' }}>
                            Your pick: {pred.predicted_home} – {pred.predicted_away}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Upcoming Matches */}
          <div>
            <div className="flex items-center justify-between mb-3 pb-3" style={{ borderBottom: '1px solid #e0dbd3' }}>
              <h2
                className="text-xl"
                style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, color: '#141414' }}
              >
                Upcoming Matches
              </h2>
              <Link
                href="/predictions"
                className="text-xs flex items-center gap-1 uppercase tracking-wider hover:opacity-70 transition-opacity"
                style={{ color: '#ff5c35', fontFamily: 'Inter, sans-serif' }}
              >
                All predictions <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div style={{ border: '1px solid #e0dbd3' }}>
              {(upcomingMatches as Match[] ?? []).map((match, idx) => (
                <div
                  key={match.id}
                  className="px-5 py-4"
                  style={{
                    background: idx % 2 === 0 ? '#ffffff' : '#faf9f6',
                    borderBottom: '1px solid #e0dbd3'
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs uppercase tracking-wider" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
                      {match.group_letter ? `Group ${match.group_letter}` : match.stage.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
                      {formatKickoff(match.kickoff_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 flex-1 justify-end">
                      <span className="text-sm font-semibold" style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}>
                        {match.home_team?.name ?? '—'}
                      </span>
                      {match.home_team?.flag_url && (
                        <img src={match.home_team.flag_url} alt="" className="w-6 h-4 object-cover flex-shrink-0" />
                      )}
                    </div>
                    <span
                      className="text-xs font-bold px-2 py-1"
                      style={{ color: '#6b6b6b', background: '#f7f4ef', fontFamily: 'Inter, sans-serif' }}
                    >
                      vs
                    </span>
                    <div className="flex items-center gap-2 flex-1">
                      {match.away_team?.flag_url && (
                        <img src={match.away_team.flag_url} alt="" className="w-6 h-4 object-cover flex-shrink-0" />
                      )}
                      <span className="text-sm font-semibold" style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}>
                        {match.away_team?.name ?? '—'}
                      </span>
                    </div>
                  </div>
                  {user && (
                    <div className="mt-2">
                      {predictionMap.has(match.id) ? (
                        <span className="text-xs" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
                          Your pick: {predictionMap.get(match.id)!.predicted_home} – {predictionMap.get(match.id)!.predicted_away}
                        </span>
                      ) : (
                        <Link
                          href="/predictions"
                          className="text-xs hover:opacity-70 transition-opacity"
                          style={{ color: '#ff5c35', fontFamily: 'Inter, sans-serif' }}
                        >
                          ⚡ No prediction yet
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {!upcomingMatches?.length && (
                <div className="px-5 py-8 text-center text-sm" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif', background: '#ffffff' }}>
                  Fixtures will appear here once loaded.
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

    </div>
  )
}
