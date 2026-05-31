import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { formatKickoff, isTournamentStarted } from '@/lib/utils'
import { Trophy, Target, Flame, Star } from 'lucide-react'
import type { PointEvent } from '@/types'

export const revalidate = 60

const EVENT_LABELS: Record<string, { label: string; color: string }> = {
  exact_score:          { label: 'Exact score',        color: 'bg-green-100 text-green-700' },
  correct_outcome:      { label: 'Correct outcome',    color: 'bg-yellow-100 text-yellow-700' },
  streak_bonus:         { label: '🔥 Streak bonus',   color: 'bg-orange-100 text-orange-700' },
  scorer_bonus:         { label: 'Goal scorer',        color: 'bg-blue-100 text-blue-700' },
  favourite_team_goal:  { label: '⭐ Secret bonus',   color: 'bg-purple-100 text-purple-700' },
  favourite_player_goal:{ label: '⭐ Secret bonus',   color: 'bg-purple-100 text-purple-700' },
  finalist_first:       { label: '🏆 Winner pick',    color: 'bg-yellow-100 text-yellow-800' },
  finalist_second:      { label: '🥈 Runner-up pick', color: 'bg-gray-100 text-gray-700' },
  finalist_third:       { label: '🥉 3rd place pick', color: 'bg-amber-100 text-amber-700' },
}

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, favourite_team:teams(*), favourite_player:players(*)')
    .eq('id', id)
    .single()

  if (!profile) notFound()

  const isMe = user?.id === id
  const tournamentStarted = isTournamentStarted()

  const { data: leaderboardEntry } = await supabase
    .from('leaderboard')
    .select('rank, matches_predicted, exact_scores, correct_outcomes')
    .eq('id', id)
    .single()

  const { data: pointEvents } = await supabase
    .from('point_events')
    .select('*, match:matches(kickoff_at, home_team:teams!home_team_id(name), away_team:teams!away_team_id(name))')
    .eq('user_id', id)
    .order('created_at', { ascending: false })
    .limit(50)

  const { data: predictions } = await supabase
    .from('predictions')
    .select('*, match:matches(kickoff_at, home_score, away_score, status, home_team:teams!home_team_id(name, flag_url), away_team:teams!away_team_id(name, flag_url))')
    .eq('user_id', id)
    .not('processed_at', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20)

  const { data: finalistPick } = await supabase
    .from('finalist_picks')
    .select('*, first_team:teams!first_team_id(*), second_team:teams!second_team_id(*), third_team:teams!third_team_id(*)')
    .eq('user_id', id)
    .single()

  const stats = {
    rank: leaderboardEntry?.rank ?? '—',
    total: profile.total_points,
    predicted: leaderboardEntry?.matches_predicted ?? 0,
    exact: leaderboardEntry?.exact_scores ?? 0,
    outcomes: leaderboardEntry?.correct_outcomes ?? 0,
    maxStreak: profile.max_streak,
    currentStreak: profile.current_streak,
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">

      {/* Profile header */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#ff5c35]/10 flex items-center justify-center text-2xl font-bold text-[#ff5c35]">
            {profile.display_name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{profile.display_name}</h1>
              {profile.favourite_team?.flag_url && (
                <img src={profile.favourite_team.flag_url} alt={profile.favourite_team.name} className="w-7 h-5 object-cover rounded-sm" />
              )}
              {profile.current_streak >= 3 && (
                <span className="streak-badge text-sm font-semibold">🔥{profile.current_streak}</span>
              )}
            </div>
            {profile.favourite_team && (
              <p className="text-sm text-gray-500 mt-0.5">{profile.favourite_team.name}</p>
            )}
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-[#ff5c35]">{stats.total}</div>
            <div className="text-xs text-gray-400 mt-0.5">points · #{stats.rank}</div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-4 gap-3 mt-5 pt-5 border-t border-gray-100">
          {[
            { label: 'Predicted', value: stats.predicted },
            { label: 'Exact scores', value: stats.exact },
            { label: 'Correct outcomes', value: stats.outcomes },
            { label: 'Best streak', value: stats.maxStreak > 0 ? `🔥${stats.maxStreak}` : '—' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <div className="text-xl font-bold text-gray-900">{s.value}</div>
              <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Secret reveal / favourite picks */}
      {tournamentStarted && (
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl border border-purple-100 p-5">
          <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Star className="w-4 h-4 text-purple-500" /> Secret bonus picks
          </h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500 text-xs mb-1">Favourite team</p>
              <div className="flex items-center gap-2">
                {profile.favourite_team?.flag_url && (
                  <img src={profile.favourite_team.flag_url} alt="" className="w-6 h-4 object-cover rounded-sm" />
                )}
                <span className="font-medium">{profile.favourite_team?.name ?? '—'}</span>
              </div>
            </div>
            <div>
              <p className="text-gray-500 text-xs mb-1">Favourite player</p>
              <span className="font-medium">{profile.favourite_player?.name ?? '—'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Finalist picks */}
      {finalistPick && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-500" /> Tournament picks
          </h2>
          <div className="grid grid-cols-3 gap-3 text-sm">
            {[
              { label: '🥇 Winner', team: finalistPick.first_team, correct: finalistPick.first_correct, pts: 300 },
              { label: '🥈 Runner-up', team: finalistPick.second_team, correct: finalistPick.second_correct, pts: 200 },
              { label: '🥉 3rd place', team: finalistPick.third_team, correct: finalistPick.third_correct, pts: 100 },
            ].map(p => (
              <div key={p.label} className={`rounded-xl p-3 text-center ${p.correct === true ? 'bg-green-50 border border-green-200' : p.correct === false ? 'bg-red-50 border border-red-100' : 'bg-gray-50'}`}>
                <div className="text-xs text-gray-500 mb-1">{p.label}</div>
                {p.team?.flag_url && <img src={p.team.flag_url} alt="" className="w-8 h-5 object-cover rounded mx-auto mb-1" />}
                <div className="font-semibold text-xs">{p.team?.name ?? '—'}</div>
                {p.correct === true && <div className="text-green-600 text-xs font-bold mt-1">+{p.pts} pts</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Points history */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Points history</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {(pointEvents as any[] ?? []).map(event => {
            const meta = EVENT_LABELS[event.type] ?? { label: event.type, color: 'bg-gray-100 text-gray-600' }
            return (
              <div key={event.id} className="px-5 py-3 flex items-center gap-3">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${meta.color}`}>
                  {meta.label}
                </span>
                <span className="text-sm text-gray-600 flex-1 truncate">
                  {event.description ?? (event.match ? `${event.match.home_team?.name} vs ${event.match.away_team?.name}` : '—')}
                </span>
                <span className="text-sm font-bold text-[#ff5c35] flex-shrink-0">+{event.points}</span>
              </div>
            )
          })}
          {!pointEvents?.length && (
            <p className="px-5 py-8 text-center text-sm text-gray-400">No points yet — make some predictions!</p>
          )}
        </div>
      </div>
    </div>
  )
}
