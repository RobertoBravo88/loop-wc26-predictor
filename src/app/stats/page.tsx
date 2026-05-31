import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export const revalidate = 300

export default async function StatsPage() {
  const supabase = await createClient()

  const { data: leaderboard } = await supabase
    .from('leaderboard')
    .select('*')
    .order('rank', { ascending: true })

  const { data: allPredictions } = await supabase
    .from('predictions')
    .select('user_id, predicted_home, predicted_away, is_exact, is_correct_outcome, points_total')
    .not('processed_at', 'is', null)

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, current_streak, max_streak, favourite_team:teams(name, flag_url)')

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

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Stats</h1>
      <p className="text-sm text-gray-500 mb-8">Tournament-wide fun stats and records.</p>

      {/* Overall numbers */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Predictions made', value: totalPredictions.toLocaleString() },
          { label: 'Exact scores', value: totalExact.toLocaleString() },
          { label: 'Accuracy', value: totalPredictions > 0 ? `${Math.round((totalExact / totalPredictions) * 100)}%` : '—' },
          { label: 'Goals predicted', value: totalGoalsPredicted.toLocaleString() },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
            <div className="text-2xl font-bold text-gray-900 mb-1">{stat.value}</div>
            <div className="text-xs text-gray-400">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Fun player awards */}
      <h2 className="font-bold text-gray-900 mb-4">Player awards</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {[
          { emoji: '⚽', title: 'Most optimistic', desc: 'Highest avg goals predicted per match', player: mostOptimistic, value: mostOptimistic ? `${(mostOptimistic.totalGoalsPredicted / mostOptimistic.totalPredictions).toFixed(1)} goals/match` : null },
          { emoji: '🛡️', title: 'Most pessimistic', desc: 'Lowest avg goals predicted per match', player: mostPessimistic, value: mostPessimistic ? `${(mostPessimistic.totalGoalsPredicted / mostPessimistic.totalPredictions).toFixed(1)} goals/match` : null },
          { emoji: '🎯', title: 'Sharpest predictor', desc: 'Best exact score hit rate', player: mostAccurate, value: mostAccurate ? `${Math.round((mostAccurate.exactScores / mostAccurate.totalPredictions) * 100)}% exact` : null },
          { emoji: '🔥', title: 'Longest streak', desc: 'Most exact scores in a row (all time)', player: longestStreak, value: longestStreak ? `${longestStreak.maxStreak} in a row` : null },
        ].map(award => (
          <div key={award.title} className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="text-2xl mb-2">{award.emoji}</div>
            <h3 className="font-bold text-gray-900 text-sm">{award.title}</h3>
            <p className="text-xs text-gray-400 mb-3">{award.desc}</p>
            {award.player ? (
              <Link href={`/profile/${award.player.id}`} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                {award.player.flag && <img src={award.player.flag} alt="" className="w-6 h-4 object-cover rounded-sm" />}
                <span className="font-semibold text-gray-800 text-sm">{award.player.name}</span>
                <span className="ml-auto text-xs text-[#ff5c35] font-bold">{award.value}</span>
              </Link>
            ) : (
              <p className="text-xs text-gray-400">No data yet</p>
            )}
          </div>
        ))}
      </div>

      {/* Currently on fire */}
      {currentHottest && (
        <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-2xl border border-orange-100 p-5 mb-8">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🔥</span>
            <div>
              <h3 className="font-bold text-gray-900">Currently on fire</h3>
              <p className="text-xs text-gray-500">Active hot streak right now</p>
            </div>
            <Link href={`/profile/${currentHottest.id}`} className="ml-auto flex items-center gap-2">
              {currentHottest.flag && <img src={currentHottest.flag} alt="" className="w-7 h-5 object-cover rounded-sm" />}
              <span className="font-bold text-gray-900">{currentHottest.name}</span>
              <span className="text-[#ff5c35] font-bold">🔥{currentHottest.currentStreak}</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
