import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { formatKickoff, isTournamentStarted } from '@/lib/utils'
import { Trophy, Star } from 'lucide-react'
import type { PointEvent } from '@/types'

export const revalidate = 60

const EVENT_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  exact_score:          { label: 'Exact score',        bg: '#dcfce7', color: '#15803d' },
  correct_outcome:      { label: 'Correct outcome',    bg: '#fef9c3', color: '#a16207' },
  streak_bonus:         { label: 'Streak bonus 🔥',    bg: '#ffedd5', color: '#c2410c' },
  scorer_bonus:         { label: 'Goal scorer',        bg: '#dbeafe', color: '#1d4ed8' },
  favourite_team_goal:  { label: 'Secret bonus',       bg: '#f3e8ff', color: '#7e22ce' },
  favourite_player_goal:{ label: 'Secret bonus',       bg: '#f3e8ff', color: '#7e22ce' },
  finalist_first:       { label: 'Winner pick',        bg: '#fef9c3', color: '#a16207' },
  finalist_second:      { label: 'Runner-up pick',     bg: '#faf9f6', color: '#6b6b6b' },
  finalist_third:       { label: '3rd place pick',     bg: '#ffedd5', color: '#c2410c' },
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

      {/* Profile header card */}
      <div style={{ background: '#ffffff', border: '1px solid #e0dbd3' }} className="p-6">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div
            className="w-14 h-14 flex items-center justify-center text-2xl font-bold text-white flex-shrink-0"
            style={{ background: '#141414', fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            {profile.display_name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1
                className="text-2xl"
                style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, color: '#141414' }}
              >
                {profile.display_name}
              </h1>
              {(tournamentStarted || isMe) && profile.favourite_team?.flag_url && (
                <img src={profile.favourite_team.flag_url} alt={profile.favourite_team.name} className="w-7 h-5 object-contain" />
              )}
              {profile.current_streak >= 3 && (
                <span className="streak-badge text-sm font-semibold">🔥{profile.current_streak}</span>
              )}
            </div>
            {(tournamentStarted || isMe) && profile.favourite_team && (
              <p className="text-sm mt-0.5" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
                {profile.favourite_team.name}
              </p>
            )}
          </div>
          <div className="text-right">
            <div
              className="text-3xl font-bold"
              style={{ color: '#ff5c35', fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              {stats.total}
            </div>
            <div className="text-xs mt-0.5" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
              points &middot; #{stats.rank}
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div
          className="grid grid-cols-4 gap-3 mt-5 pt-5"
          style={{ borderTop: '1px solid #e0dbd3' }}
        >
          {[
            { label: 'Predicted', value: stats.predicted },
            { label: 'Exact scores', value: stats.exact },
            { label: 'Correct outcomes', value: stats.outcomes },
            { label: 'Peak Form', value: stats.maxStreak > 0 ? `🔥${stats.maxStreak}` : '—' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <div
                className="text-xl font-bold"
                style={{ color: '#141414', fontFamily: "'Playfair Display', Georgia, serif" }}
              >
                {s.value}
              </div>
              <div className="text-xs mt-0.5" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Secret bonus picks */}
      {tournamentStarted && (
        <div style={{ background: '#ffffff', border: '1px solid #e0dbd3' }} className="p-5">
          <h2
            className="text-lg mb-3 flex items-center gap-2 pb-2"
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontWeight: 700,
              color: '#141414',
              borderBottom: '1px solid #e0dbd3'
            }}
          >
            <Star className="w-4 h-4" style={{ color: '#6b6b6b' }} /> 12th Man Bonus
          </h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
                Favourite team
              </p>
              <div className="flex items-center gap-2">
                {profile.favourite_team?.flag_url && (
                  <img src={profile.favourite_team.flag_url} alt="" className="w-6 h-4 object-contain" />
                )}
                <span className="font-medium" style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}>
                  {profile.favourite_team?.name ?? '—'}
                </span>
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
                Favourite player
              </p>
              <span className="font-medium" style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}>
                {profile.favourite_player?.name ?? '—'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Finalist picks */}
      {finalistPick && (
        <div style={{ background: '#ffffff', border: '1px solid #e0dbd3' }} className="p-5">
          <h2
            className="text-lg mb-3 pb-2 flex items-center gap-2"
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontWeight: 700,
              color: '#141414',
              borderBottom: '1px solid #e0dbd3'
            }}
          >
            <Trophy className="w-4 h-4" style={{ color: '#6b6b6b' }} /> Tournament Picks
          </h2>
          <div className="grid grid-cols-3 gap-3 text-sm">
            {[
              { label: 'Winner', team: finalistPick.first_team, correct: finalistPick.first_correct, pts: 300 },
              { label: 'Runner-up', team: finalistPick.second_team, correct: finalistPick.second_correct, pts: 200 },
              { label: '3rd place', team: finalistPick.third_team, correct: finalistPick.third_correct, pts: 100 },
            ].map(p => (
              <div
                key={p.label}
                className="p-3 text-center"
                style={{
                  border: `1px solid ${p.correct === true ? '#86efac' : p.correct === false ? '#fca5a5' : '#e0dbd3'}`,
                  background: p.correct === true ? '#f0fdf4' : p.correct === false ? '#fff5f5' : '#faf9f6'
                }}
              >
                <div className="text-xs uppercase tracking-wider mb-1" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
                  {p.label}
                </div>
                {p.team?.flag_url && (
                  <img src={p.team.flag_url} alt="" className="w-8 h-5 object-contain mx-auto mb-1" />
                )}
                <div className="text-xs font-semibold" style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}>
                  {p.team?.name ?? '—'}
                </div>
                {p.correct === true && (
                  <div className="text-xs font-bold mt-1" style={{ color: '#ff5c35', fontFamily: 'Inter, sans-serif' }}>
                    +{p.pts} pts
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Points history */}
      <div style={{ background: '#ffffff', border: '1px solid #e0dbd3' }}>
        <div className="px-5 py-3" style={{ borderBottom: '1px solid #e0dbd3' }}>
          <h2
            className="text-lg"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, color: '#141414' }}
          >
            Points History
          </h2>
        </div>
        <div>
          {(pointEvents as any[] ?? []).map((event, idx) => {
            const meta = EVENT_LABELS[event.type] ?? { label: event.type, bg: '#faf9f6', color: '#6b6b6b' }
            return (
              <div
                key={event.id}
                className="px-5 py-3 flex items-center gap-3"
                style={{
                  background: idx % 2 === 0 ? '#ffffff' : '#faf9f6',
                  borderBottom: '1px solid #e0dbd3'
                }}
              >
                <span
                  className="text-xs font-semibold px-2 py-0.5 flex-shrink-0 uppercase tracking-wider"
                  style={{ background: meta.bg, color: meta.color, fontFamily: 'Inter, sans-serif' }}
                >
                  {meta.label}
                </span>
                <span className="text-sm flex-1 truncate" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
                  {event.description ?? (event.match ? `${event.match.home_team?.name} vs ${event.match.away_team?.name}` : '—')}
                </span>
                <span className="text-sm font-bold flex-shrink-0" style={{ color: '#ff5c35', fontFamily: 'Inter, sans-serif' }}>
                  +{event.points}
                </span>
              </div>
            )
          })}
          {!pointEvents?.length && (
            <p
              className="px-5 py-8 text-center text-sm"
              style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}
            >
              No points yet — make some predictions!
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
