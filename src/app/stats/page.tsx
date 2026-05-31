import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export const revalidate = 300

export default async function StatsPage() {
  const supabase = await createClient()

  const [
    { data: leaderboard },
    { data: allPredictions },
    { data: profiles },
    { data: finalistPicks },
    { data: scorerPicks },
  ] = await Promise.all([
    supabase.from('leaderboard').select('*').order('rank', { ascending: true }),
    supabase.from('predictions').select('user_id, predicted_home, predicted_away, is_exact, is_correct_outcome, points_total').not('processed_at', 'is', null),
    supabase.from('profiles').select('id, display_name, current_streak, max_streak, favourite_team:teams(name, flag_url)'),
    supabase.from('finalist_picks').select('first_team_id, second_team_id, third_team_id, first_team:teams!first_team_id(name, flag_url), second_team:teams!second_team_id(name, flag_url), third_team:teams!third_team_id(name, flag_url)'),
    supabase.from('scorer_picks').select('player_id, player:players(name, team:teams(name, flag_url))'),
  ])

  // Compute fun stats
  const userStats = new Map<string, {
    id: string
    name: string
    totalGoalsPredicted: number
    totalPredictions: number
    exactScores: number
    flag?: string | null
    teamName?: string | null
    maxStreak: number
    currentStreak: number
  }>()

  for (const p of profiles ?? []) {
    userStats.set(p.id, {
      id: p.id,
      name: p.display_name,
      totalGoalsPredicted: 0,
      totalPredictions: 0,
      exactScores: 0,
      flag: (p.favourite_team as any)?.flag_url,
      teamName: (p.favourite_team as any)?.name,
      maxStreak: p.max_streak,
      currentStreak: p.current_streak,
    })
  }

  for (const pred of allPredictions ?? []) {
    const u = userStats.get(pred.user_id)
    if (!u) continue
    u.totalGoalsPredicted += (pred.predicted_home ?? 0) + (pred.predicted_away ?? 0)
    u.totalPredictions++
    if (pred.is_exact) u.exactScores++
  }

  const users = Array.from(userStats.values()).filter(u => u.totalPredictions > 0)

  const mostOptimistic = [...users].sort((a, b) => (b.totalGoalsPredicted / b.totalPredictions) - (a.totalGoalsPredicted / a.totalPredictions))[0]
  const mostPessimistic = [...users].sort((a, b) => (a.totalGoalsPredicted / a.totalPredictions) - (b.totalGoalsPredicted / b.totalPredictions))[0]
  const mostAccurate = [...users].sort((a, b) => (b.exactScores / b.totalPredictions) - (a.exactScores / a.totalPredictions))[0]
  const longestStreak = [...users].sort((a, b) => b.maxStreak - a.maxStreak)[0]
  const currentHottest = [...users].filter(u => u.currentStreak >= 3).sort((a, b) => b.currentStreak - a.currentStreak)[0]

  const totalGoalsPredicted = (allPredictions ?? []).reduce((s, p) => s + (p.predicted_home ?? 0) + (p.predicted_away ?? 0), 0)
  const totalExact = (allPredictions ?? []).filter(p => p.is_exact).length
  const totalPredictions = (allPredictions ?? []).length

  // --- Top supported teams (favourite team counts) ---
  const teamSupportMap = new Map<string, { name: string; flag: string | null; count: number }>()
  for (const p of profiles ?? []) {
    const team = (p.favourite_team as any)
    if (!team) continue
    const existing = teamSupportMap.get(team.name)
    if (existing) existing.count++
    else teamSupportMap.set(team.name, { name: team.name, flag: team.flag_url, count: 1 })
  }
  const topSupportedTeams = Array.from(teamSupportMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // --- Highest rated teams (finalist picks: 1st=3, 2nd=2, 3rd=1) ---
  const teamRatingMap = new Map<string, { name: string; flag: string | null; score: number }>()
  function addTeamRating(team: any, pts: number) {
    if (!team) return
    const existing = teamRatingMap.get(team.name)
    if (existing) existing.score += pts
    else teamRatingMap.set(team.name, { name: team.name, flag: team.flag_url, score: pts })
  }
  for (const pick of finalistPicks ?? []) {
    addTeamRating((pick as any).first_team, 3)
    addTeamRating((pick as any).second_team, 2)
    addTeamRating((pick as any).third_team, 1)
  }
  const topRatedTeams = Array.from(teamRatingMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  // --- Highest rated top scorers (scorer picks: each pick = 1) ---
  const playerPickMap = new Map<string, { name: string; teamName: string | null; flag: string | null; count: number }>()
  for (const pick of scorerPicks ?? []) {
    const player = (pick as any).player
    if (!player) continue
    const existing = playerPickMap.get(player.name)
    if (existing) existing.count++
    else playerPickMap.set(player.name, {
      name: player.name,
      teamName: player.team?.name ?? null,
      flag: player.team?.flag_url ?? null,
      count: 1,
    })
  }
  const topRatedScorers = Array.from(playerPickMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">

      {/* Page header */}
      <div className="mb-8 pb-3" style={{ borderBottom: '2px solid #141414' }}>
        <h1
          className="text-4xl mb-1"
          style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 900, color: '#141414' }}
        >
          The Loop Report
        </h1>
        <p className="text-xs uppercase tracking-wider" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
          Tournament-wide stats &amp; intelligence
        </p>
      </div>

      {/* Overall numbers — newspaper stat boxes */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 mb-10" style={{ border: '1px solid #e0dbd3' }}>
        {[
          { label: 'Predictions made', value: totalPredictions.toLocaleString() },
          { label: 'Exact scores', value: totalExact.toLocaleString() },
          { label: 'Accuracy', value: totalPredictions > 0 ? `${Math.round((totalExact / totalPredictions) * 100)}%` : '—' },
          { label: 'Goals predicted', value: totalGoalsPredicted.toLocaleString() },
        ].map((stat, idx) => (
          <div
            key={stat.label}
            className="p-5 text-center"
            style={{
              background: '#ffffff',
              borderRight: idx < 3 ? '1px solid #e0dbd3' : 'none',
              borderBottom: idx >= 2 ? 'none' : undefined
            }}
          >
            <div
              className="text-3xl font-bold mb-1"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", color: '#141414' }}
            >
              {stat.value}
            </div>
            <div className="text-xs uppercase tracking-wider" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Player awards */}
      <h2
        className="text-2xl mb-4 pb-3"
        style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontWeight: 700,
          color: '#141414',
          borderBottom: '1px solid #e0dbd3'
        }}
      >
        Loop Legends
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 mb-8" style={{ border: '1px solid #e0dbd3' }}>
        {[
          { emoji: '⚽', title: 'Most optimistic', desc: 'Highest avg goals predicted per match', player: mostOptimistic, value: mostOptimistic ? `${(mostOptimistic.totalGoalsPredicted / mostOptimistic.totalPredictions).toFixed(1)} goals/match` : null },
          { emoji: '🛡️', title: 'Most pessimistic', desc: 'Lowest avg goals predicted per match', player: mostPessimistic, value: mostPessimistic ? `${(mostPessimistic.totalGoalsPredicted / mostPessimistic.totalPredictions).toFixed(1)} goals/match` : null },
          { emoji: '🎯', title: 'Sharpest predictor', desc: 'Best exact score hit rate', player: mostAccurate, value: mostAccurate ? `${Math.round((mostAccurate.exactScores / mostAccurate.totalPredictions) * 100)}% exact` : null },
          { emoji: '🔥', title: 'Longest streak', desc: 'Most exact scores in a row (all time)', player: longestStreak, value: longestStreak ? `${longestStreak.maxStreak} in a row` : null },
        ].map((award, idx) => (
          <div
            key={award.title}
            className="p-5"
            style={{
              background: idx % 2 === 0 ? '#ffffff' : '#faf9f6',
              borderBottom: idx < 2 ? '1px solid #e0dbd3' : 'none',
              borderRight: idx % 2 === 0 ? '1px solid #e0dbd3' : 'none'
            }}
          >
            <div className="text-2xl mb-2">{award.emoji}</div>
            <h3
              className="text-sm font-semibold mb-0.5"
              style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}
            >
              {award.title}
            </h3>
            <p className="text-xs mb-3" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
              {award.desc}
            </p>
            {award.player ? (
              <Link
                href={`/profile/${award.player.id}`}
                className="flex items-center gap-2 hover:opacity-70 transition-opacity"
              >
                {award.player.flag && (
                  <img src={award.player.flag} alt="" className="w-6 h-4 object-contain" />
                )}
                <span className="font-semibold text-sm" style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}>
                  {award.player.name}
                </span>
                <span className="ml-auto text-xs font-bold" style={{ color: '#ff5c35', fontFamily: 'Inter, sans-serif' }}>
                  {award.value}
                </span>
              </Link>
            ) : (
              <p className="text-xs" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>No data yet</p>
            )}
          </div>
        ))}
      </div>

      {/* Currently on fire */}
      {currentHottest && (
        <div
          className="p-5 flex items-center gap-4"
          style={{ border: '1px solid #e0dbd3', background: '#ffffff', borderLeft: '4px solid #ff5c35' }}
        >
          <span className="text-3xl">🔥</span>
          <div>
            <h3
              className="text-base font-bold"
              style={{ color: '#141414', fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              Loop&apos;s Hottest 🔥
            </h3>
            <p className="text-xs" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
              Active hot streak right now
            </p>
          </div>
          <Link
            href={`/profile/${currentHottest.id}`}
            className="ml-auto flex items-center gap-2 hover:opacity-70 transition-opacity"
          >
            {currentHottest.flag && (
              <img src={currentHottest.flag} alt="" className="w-7 h-5 object-contain" />
            )}
            <span className="font-bold" style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}>
              {currentHottest.name}
            </span>
            <span className="font-bold" style={{ color: '#ff5c35', fontFamily: 'Inter, sans-serif' }}>
              🔥{currentHottest.currentStreak}
            </span>
          </Link>
        </div>
      )}

      {/* Community Picks */}
      <h2
        className="text-2xl mt-10 mb-4 pb-3"
        style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontWeight: 700,
          color: '#141414',
          borderBottom: '1px solid #e0dbd3'
        }}
      >
        Loop Intelligence
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">

        {/* Top Supported Teams */}
        <div style={{ border: '1px solid #e0dbd3' }}>
          <div
            className="px-4 py-3 text-xs font-semibold uppercase tracking-wider"
            style={{ background: '#141414', color: '#ffffff', fontFamily: 'Inter, sans-serif' }}
          >
            🏴 Top Supported Teams
          </div>
          {topSupportedTeams.length === 0 ? (
            <p className="px-4 py-6 text-xs text-center" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
              No data yet
            </p>
          ) : topSupportedTeams.map((team, i) => (
            <div
              key={team.name}
              className="flex items-center gap-3 px-4 py-2.5"
              style={{
                background: i % 2 === 0 ? '#ffffff' : '#faf9f6',
                borderBottom: i < topSupportedTeams.length - 1 ? '1px solid #e0dbd3' : 'none',
              }}
            >
              <span
                className="w-4 text-xs font-bold text-center flex-shrink-0"
                style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}
              >
                {i + 1}
              </span>
              {team.flag && (
                <img src={team.flag} alt="" className="w-6 h-4 object-contain flex-shrink-0" />
              )}
              <span className="flex-1 text-sm truncate" style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}>
                {team.name}
              </span>
              <span className="text-xs font-bold flex-shrink-0" style={{ color: '#ff5c35', fontFamily: 'Inter, sans-serif' }}>
                {team.count} {team.count === 1 ? 'fan' : 'fans'}
              </span>
            </div>
          ))}
        </div>

        {/* Highest Rated Teams */}
        <div style={{ border: '1px solid #e0dbd3' }}>
          <div
            className="px-4 py-3 text-xs font-semibold uppercase tracking-wider"
            style={{ background: '#141414', color: '#ffffff', fontFamily: 'Inter, sans-serif' }}
          >
            🏆 Highest Rated Teams
          </div>
          <div className="px-4 py-1.5" style={{ borderBottom: '1px solid #e0dbd3', background: '#faf9f6' }}>
            <p className="text-xs" style={{ color: '#9ca3af', fontFamily: 'Inter, sans-serif' }}>
              Winner=3 pts · Runner-up=2 pts · 3rd=1 pt
            </p>
          </div>
          {topRatedTeams.length === 0 ? (
            <p className="px-4 py-6 text-xs text-center" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
              No picks locked in yet
            </p>
          ) : topRatedTeams.map((team, i) => (
            <div
              key={team.name}
              className="flex items-center gap-3 px-4 py-2.5"
              style={{
                background: i % 2 === 0 ? '#ffffff' : '#faf9f6',
                borderBottom: i < topRatedTeams.length - 1 ? '1px solid #e0dbd3' : 'none',
              }}
            >
              <span
                className="w-4 text-xs font-bold text-center flex-shrink-0"
                style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}
              >
                {i + 1}
              </span>
              {team.flag && (
                <img src={team.flag} alt="" className="w-6 h-4 object-contain flex-shrink-0" />
              )}
              <span className="flex-1 text-sm truncate" style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}>
                {team.name}
              </span>
              <span className="text-xs font-bold flex-shrink-0" style={{ color: '#ff5c35', fontFamily: 'Inter, sans-serif' }}>
                {team.score} pts
              </span>
            </div>
          ))}
        </div>

        {/* Highest Rated Top Scorers */}
        <div style={{ border: '1px solid #e0dbd3' }}>
          <div
            className="px-4 py-3 text-xs font-semibold uppercase tracking-wider"
            style={{ background: '#141414', color: '#ffffff', fontFamily: 'Inter, sans-serif' }}
          >
            ⚽ Most Picked Scorers
          </div>
          {topRatedScorers.length === 0 ? (
            <p className="px-4 py-6 text-xs text-center" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
              No picks yet
            </p>
          ) : topRatedScorers.map((player, i) => (
            <div
              key={player.name}
              className="flex items-center gap-3 px-4 py-2.5"
              style={{
                background: i % 2 === 0 ? '#ffffff' : '#faf9f6',
                borderBottom: i < topRatedScorers.length - 1 ? '1px solid #e0dbd3' : 'none',
              }}
            >
              <span
                className="w-4 text-xs font-bold text-center flex-shrink-0"
                style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}
              >
                {i + 1}
              </span>
              {player.flag && (
                <img src={player.flag} alt="" className="w-6 h-4 object-contain flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <span className="text-sm block truncate" style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}>
                  {player.name}
                </span>
                {player.teamName && (
                  <span className="text-xs" style={{ color: '#9ca3af', fontFamily: 'Inter, sans-serif' }}>
                    {player.teamName}
                  </span>
                )}
              </div>
              <span className="text-xs font-bold flex-shrink-0" style={{ color: '#ff5c35', fontFamily: 'Inter, sans-serif' }}>
                {player.count} {player.count === 1 ? 'pick' : 'picks'}
              </span>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
