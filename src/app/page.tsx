import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { isTournamentStarted, stageName, getNow } from '@/lib/utils'
import LocalTime from '@/components/ui/LocalTime'
import CountdownTimer from '@/components/ui/CountdownTimer'
import { ChevronRight } from 'lucide-react'
import type { Match, LeaderboardEntry, NewsPost } from '@/types'
import NewsCarousel from '@/components/home/NewsCarousel'
import PlayerScoredBanner, { type ScoredGoal } from '@/components/home/PlayerScoredBanner'
import AchievementToast from '@/components/ui/AchievementToast'
import MatchCentre from '@/components/home/MatchCentre'
import { getMatchCentreData } from '@/lib/matchCentre'
import TeamFanBadge from '@/components/ui/TeamFanBadge'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch profile to check role
  let profile: { role: string } | null = null
  if (user) {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    profile = profileData
  }

  // Match Centre data — admin only
  const isAdmin = profile?.role === 'admin'
  const matchCentreData = isAdmin ? await getMatchCentreData(true) : null

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
    .limit(10)

  // Fetch current user's own leaderboard entry so we can show it even if outside top 10
  let myLeaderboardEntry: LeaderboardEntry | null = null
  if (user) {
    const { data: myEntry } = await supabase
      .from('leaderboard')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()
    myLeaderboardEntry = myEntry
  }

  const { data: posts } = await supabase
    .from('news_posts')
    .select('*, author:profiles(display_name)')
    .eq('is_published', true)
    .order('published_at', { ascending: false })
    .limit(10)

  // Fetch reactions for the carousel posts
  const carouselPostIds = (posts ?? []).map((p: any) => p.id)
  const { data: carouselReactions } = carouselPostIds.length
    ? await supabase
        .from('news_reactions')
        .select('id, emoji, user_id, post_id, profiles(display_name)')
        .in('post_id', carouselPostIds)
    : { data: [] }
  const reactionsByPost: Record<string, any[]> = {}
  for (const r of carouselReactions ?? []) {
    if (!reactionsByPost[r.post_id]) reactionsByPost[r.post_id] = []
    reactionsByPost[r.post_id].push(r)
  }

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

  // Fan counts per team
  const { data: fanData } = await supabase
    .from('profiles')
    .select('favourite_team_id')
    .not('favourite_team_id', 'is', null)
  const fanCountMap: Record<string, number> = {}
  for (const row of fanData ?? []) {
    if (row.favourite_team_id) {
      fanCountMap[row.favourite_team_id] = (fanCountMap[row.favourite_team_id] ?? 0) + 1
    }
  }

  const tournamentStarted = isTournamentStarted()

  // Fetch recently earned badges for achievement toast (last 1h)
  let recentBadges: Array<{ badge_id: string; earned_at: string; user_id: string }> = []
  if (user) {
    const { data: badgeData } = await supabase
      .from('user_badges')
      .select('badge_id, earned_at')
      .eq('user_id', user.id)
      .gte('earned_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .order('earned_at', { ascending: false })
    recentBadges = (badgeData ?? []).map(b => ({ ...b, user_id: user.id }))
  }

  // Fetch recent (last 48h) goal bonuses for this user
  let scoredGoals: ScoredGoal[] = []
  if (user) {
    const { data: recentBonuses } = await supabase
      .from('point_events')
      .select('id, type, points, goal_event_id, goal_event:goal_events(id, player:players(name), team:teams(flag_url))')
      .eq('user_id', user.id)
      .in('type', ['scorer_bonus', 'favourite_player_goal', 'favourite_team_goal'])
      .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })

    scoredGoals = (recentBonuses ?? []).map((ev: any) => {
      const goalEvent = Array.isArray(ev.goal_event) ? ev.goal_event[0] : ev.goal_event
      const type: ScoredGoal['type'] =
        ev.type === 'scorer_bonus' ? 'scorer' :
        ev.type === 'favourite_player_goal' ? 'player' :
        'team'
      const player = Array.isArray(goalEvent?.player) ? goalEvent.player[0] : goalEvent?.player
      const team = Array.isArray(goalEvent?.team) ? goalEvent.team[0] : goalEvent?.team
      return {
        playerName: player?.name ?? 'Player',
        teamFlag: team?.flag_url ?? null,
        points: ev.points,
        type,
        goalEventId: ev.goal_event_id ?? ev.id,
      } satisfies ScoredGoal
    })
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">

      {/* Recent goal bonuses banner */}
      {scoredGoals.length > 0 && (
        <PlayerScoredBanner goals={scoredGoals} />
      )}

      {/* Achievement toast */}
      {recentBadges.length > 0 && <AchievementToast recentBadges={recentBadges} />}

      {/* Hero — compact editorial masthead */}
      <section style={{ background: '#141414' }} className="relative overflow-hidden">
        <div className="px-8 py-8 relative">
          <h1
            className="text-3xl sm:text-4xl text-white mb-3 leading-tight"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 900 }}
          >
            Loop WC26<br />Predictor
          </h1>
          <p className="text-sm mb-3 max-w-lg" style={{ color: '#9ca3af', fontFamily: 'Inter, sans-serif' }}>
            Predict every match, earn points, climb the table. Let&apos;s bring the noise.
          </p>
          {!tournamentStarted && (
            <CountdownTimer targetDate={process.env.NEXT_PUBLIC_TOURNAMENT_START ?? '2026-06-11T16:00:00Z'} />
          )}
          <div className="mt-5" />
          {!user ? (
            <div className="flex flex-col gap-2">
              <Link
                href="/auth/login"
                className="inline-block px-4 py-2 text-xs font-semibold text-white transition-colors"
                style={{ background: '#ff5c35', fontFamily: 'Inter, sans-serif' }}
              >
                Sign in
              </Link>
              <p className="text-xs" style={{ color: '#9ca3af', fontFamily: 'Inter, sans-serif' }}>
                No account yet?{' '}
                <Link href="/auth/signup" className="underline hover:text-white transition-colors">
                  Create one here
                </Link>
              </p>
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

      {/* Match Centre — admin only, above news */}
      {profile?.role === 'admin' && matchCentreData && (
        <MatchCentre data={matchCentreData} currentUserId={user?.id ?? null} />
      )}

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

        {posts && posts.length > 0 ? (
          <NewsCarousel posts={posts as any[]} reactionsByPost={reactionsByPost} userId={user?.id ?? null} />
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
          {(() => {
            const leaderList = leaders as LeaderboardEntry[] ?? []
            const userInTop = leaderList.some(e => e.id === user?.id)
            return (
              <div style={{ background: '#ffffff', border: '1px solid #e0dbd3' }}>
                {leaderList.map((entry, i) => {
                  const isMe = user?.id === entry.id
                  return (
                    <Link key={entry.id} href={`/profile/${entry.id}`}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:opacity-80"
                      style={{
                        borderBottom: '1px solid #e0dbd3',
                        background: isMe ? '#fff8f0' : '#ffffff',
                        borderLeft: isMe ? '3px solid #ff5c35' : '3px solid transparent',
                      }}>
                      <span
                        className="w-5 text-center text-sm font-bold"
                        style={{
                          fontFamily: 'Inter, sans-serif',
                          color: i === 0 ? '#ca8a04' : i === 1 ? '#9ca3af' : i === 2 ? '#b45309' : '#6b6b6b'
                        }}
                      >
                        {entry.rank}
                      </span>
                      {tournamentStarted && entry.favourite_team_flag ? (
                        <img src={entry.favourite_team_flag} alt="" className="w-6 h-4 object-contain flex-shrink-0" />
                      ) : (
                        <div className="w-6 h-4 flex-shrink-0" style={{ background: '#f7f4ef' }} />
                      )}
                      <span className="flex-1 text-sm truncate" style={{ color: '#141414', fontFamily: 'Inter, sans-serif', fontWeight: isMe ? 600 : 400 }}>
                        {entry.display_name}
                      </span>
                      {entry.current_streak >= 3 && (
                        <span className="streak-badge text-xs">🔥{entry.current_streak}</span>
                      )}
                      <span className="text-sm font-bold" style={{ color: '#ff5c35', fontFamily: 'Inter, sans-serif' }}>
                        {entry.total_points}
                      </span>
                    </Link>
                  )
                })}

                {/* If user is logged in but outside the top 10 — show separator + their row */}
                {user && myLeaderboardEntry && !userInTop && (
                  <>
                    <div
                      className="flex items-center gap-2 px-4 py-1"
                      style={{ borderBottom: '1px solid #e0dbd3', background: '#faf9f7' }}
                    >
                      <div style={{ flex: 1, height: 1, background: '#e0dbd3' }} />
                      <span className="text-xs" style={{ color: '#c4bfb8', fontFamily: 'Inter, sans-serif', letterSpacing: '0.1em' }}>
                        #{myLeaderboardEntry.rank}
                      </span>
                      <div style={{ flex: 1, height: 1, background: '#e0dbd3' }} />
                    </div>
                    <Link
                      href={`/profile/${myLeaderboardEntry.id}`}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:opacity-80"
                      style={{
                        background: '#fff8f0',
                        borderLeft: '3px solid #ff5c35',
                      }}
                    >
                      <span
                        className="w-5 text-center text-sm font-bold"
                        style={{ fontFamily: 'Inter, sans-serif', color: '#6b6b6b' }}
                      >
                        {myLeaderboardEntry.rank}
                      </span>
                      {tournamentStarted && myLeaderboardEntry.favourite_team_flag ? (
                        <img src={myLeaderboardEntry.favourite_team_flag} alt="" className="w-6 h-4 object-contain flex-shrink-0" />
                      ) : (
                        <div className="w-6 h-4 flex-shrink-0" style={{ background: '#f7f4ef' }} />
                      )}
                      <span className="flex-1 text-sm font-semibold truncate" style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}>
                        {myLeaderboardEntry.display_name}
                      </span>
                      {myLeaderboardEntry.current_streak >= 3 && (
                        <span className="streak-badge text-xs">🔥{myLeaderboardEntry.current_streak}</span>
                      )}
                      <span className="text-sm font-bold" style={{ color: '#ff5c35', fontFamily: 'Inter, sans-serif' }}>
                        {myLeaderboardEntry.total_points}
                      </span>
                    </Link>
                  </>
                )}

                {!leaderList.length && (
                  <p className="px-4 py-6 text-sm text-center" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
                    Still thinking? Make some noise.
                  </p>
                )}
              </div>
            )
          })()}
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
                          {match.group_letter ? `Group ${match.group_letter}` : stageName(match.stage)}
                        </span>
                        <span className="text-xs" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
                          <LocalTime date={match.kickoff_at} />
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 flex-1 justify-end">
                          {match.home_team ? (
                            <Link href={`/teams/${match.home_team.id}`} className="text-sm font-semibold hover:underline" style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}>
                              {match.home_team.name}
                            </Link>
                          ) : <span className="text-sm font-semibold" style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}>—</span>}
                          {match.home_team?.flag_url && (
                            <img src={match.home_team.flag_url} alt="" className="w-6 h-4 object-contain flex-shrink-0" />
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
                            <img src={match.away_team.flag_url} alt="" className="w-6 h-4 object-contain flex-shrink-0" />
                          )}
                          {match.away_team ? (
                            <Link href={`/teams/${match.away_team.id}`} className="text-sm font-semibold hover:underline" style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}>
                              {match.away_team.name}
                            </Link>
                          ) : <span className="text-sm font-semibold" style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}>—</span>}
                        </div>
                      </div>
                      {user && pred && (
                        <div className="mt-2">
                          <span className="text-xs" style={{ color: '#9ca3af', fontFamily: 'Inter, sans-serif' }}>
                            Your call: {pred.predicted_home} – {pred.predicted_away}
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
                      {match.group_letter ? `Group ${match.group_letter}` : stageName(match.stage)}
                    </span>
                    <span className="flex items-center gap-2 text-xs" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
                      {(() => {
                        const now = getNow()
                        const kickoff = new Date(match.kickoff_at)
                        const diffMs = kickoff.getTime() - now.getTime()
                        if (diffMs <= 0) return null
                        const diffHours = diffMs / (1000 * 60 * 60)
                        let lockText: string | null = null
                        if (diffHours <= 48) {
                          const h = Math.floor(diffHours)
                          const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
                          lockText = `Locks in ${h}h ${m}m`
                        } else if (diffHours <= 168) {
                          lockText = `Locks in ${Math.floor(diffHours / 24)} days`
                        }
                        if (!lockText) return null
                        const pred = predictionMap.get(match.id)
                        return pred ? (
                          <span style={{ background: 'transparent', color: '#ff5c35', border: '1px solid #ff5c35', fontFamily: 'Inter, sans-serif', fontSize: '0.65rem', fontWeight: 600, padding: '1px 6px' }}>{lockText}</span>
                        ) : (
                          <span style={{ background: '#ff5c35', color: '#ffffff', fontFamily: 'Inter, sans-serif', fontSize: '0.65rem', fontWeight: 600, padding: '1px 6px' }}>{lockText}</span>
                        )
                      })()}
                      <LocalTime date={match.kickoff_at} />
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 flex-1 justify-end">
                      {match.home_team && <TeamFanBadge teamId={match.home_team.id} count={fanCountMap[match.home_team.id] ?? 0} />}
                      {match.home_team ? (
                        <Link href={`/teams/${match.home_team.id}`} className="text-sm font-semibold hover:underline" style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}>
                          {match.home_team.name}
                        </Link>
                      ) : <span className="text-sm font-semibold" style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}>—</span>}
                      {match.home_team?.flag_url && (
                        <img src={match.home_team.flag_url} alt="" className="w-6 h-4 object-contain flex-shrink-0" />
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
                        <img src={match.away_team.flag_url} alt="" className="w-6 h-4 object-contain flex-shrink-0" />
                      )}
                      {match.away_team ? (
                        <Link href={`/teams/${match.away_team.id}`} className="text-sm font-semibold hover:underline" style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}>
                          {match.away_team.name}
                        </Link>
                      ) : <span className="text-sm font-semibold" style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}>—</span>}
                      {match.away_team && <TeamFanBadge teamId={match.away_team.id} count={fanCountMap[match.away_team.id] ?? 0} />}
                    </div>
                  </div>
                  {user && (
                    <div className="mt-2">
                      {predictionMap.has(match.id) ? (
                        <span className="text-xs" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
                          Your call: {predictionMap.get(match.id)!.predicted_home} – {predictionMap.get(match.id)!.predicted_away}
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
