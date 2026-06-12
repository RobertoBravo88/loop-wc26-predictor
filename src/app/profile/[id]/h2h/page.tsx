import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { BADGE_MAP, RARITY_ORDER } from '@/lib/badges/definitions'

export const revalidate = 60

const EVENT_LABELS: Record<string, string> = {
  exact_score:           'Exact score',
  correct_outcome:       'Correct outcome',
  streak_bonus:          '🔥 Streak bonus',
  scorer_bonus:          'Goal scorer',
  favourite_team_goal:   'Secret bonus',
  favourite_player_goal: 'Secret bonus',
}

type EventEntry = { id: string; type: string; points: number; description: string | null }

type UserMatchData = {
  prediction: string
  points: number
  events: EventEntry[]
}

type MatchEntry = {
  matchId: string
  kickoffAt: string
  homeTeam: string
  awayTeam: string
  homeFlagUrl: string | null
  awayFlagUrl: string | null
  homeScore: number | null
  awayScore: number | null
  userA: UserMatchData | null
  userB: UserMatchData | null
}

export default async function H2HPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')
  if (user.id === id) redirect(`/profile/${id}`)

  const [profileARes, profileBRes, rankARes, rankBRes] = await Promise.all([
    supabase.from('profiles').select('*, favourite_team:teams(*)').eq('id', user.id).single(),
    supabase.from('profiles').select('*, favourite_team:teams(*)').eq('id', id).single(),
    supabase.from('leaderboard').select('rank').eq('id', user.id).single(),
    supabase.from('leaderboard').select('rank').eq('id', id).single(),
  ])

  const profileA = profileARes.data
  const profileB = profileBRes.data
  if (!profileA || !profileB) notFound()

  const [predsARes, predsBRes, eventsARes, eventsBRes, badgesARes, badgesBRes] = await Promise.all([
    supabase
      .from('predictions')
      .select('id, match_id, predicted_home, predicted_away, match:matches(kickoff_at, home_score, away_score, home_team:teams!home_team_id(name, flag_url), away_team:teams!away_team_id(name, flag_url))')
      .eq('user_id', user.id)
      .not('processed_at', 'is', null),
    supabase
      .from('predictions')
      .select('id, match_id, predicted_home, predicted_away, match:matches(kickoff_at, home_score, away_score, home_team:teams!home_team_id(name, flag_url), away_team:teams!away_team_id(name, flag_url))')
      .eq('user_id', id)
      .not('processed_at', 'is', null),
    supabase
      .from('point_events')
      .select('id, match_id, type, points, description')
      .eq('user_id', user.id)
      .not('match_id', 'is', null),
    supabase
      .from('point_events')
      .select('id, match_id, type, points, description')
      .eq('user_id', id)
      .not('match_id', 'is', null),
    supabase.from('user_badges').select('badge_id, earned_at').eq('user_id', user.id),
    supabase.from('user_badges').select('badge_id, earned_at').eq('user_id', id),
  ])

  const predsA   = (predsARes.data ?? []) as any[]
  const predsB   = (predsBRes.data ?? []) as any[]
  const eventsA  = (eventsARes.data ?? []) as any[]
  const eventsB  = (eventsBRes.data ?? []) as any[]
  const badgesA  = (badgesARes.data ?? []) as any[]
  const badgesB  = (badgesBRes.data ?? []) as any[]

  // Group events by match_id
  const evMapA = new Map<string, EventEntry[]>()
  const evMapB = new Map<string, EventEntry[]>()
  for (const ev of eventsA) {
    if (!ev.match_id) continue
    if (!evMapA.has(ev.match_id)) evMapA.set(ev.match_id, [])
    evMapA.get(ev.match_id)!.push(ev)
  }
  for (const ev of eventsB) {
    if (!ev.match_id) continue
    if (!evMapB.has(ev.match_id)) evMapB.set(ev.match_id, [])
    evMapB.get(ev.match_id)!.push(ev)
  }

  // Build match map from both users' predictions
  const matchMap = new Map<string, MatchEntry>()

  for (const pred of predsA) {
    const m = pred.match as any
    if (!m || !pred.match_id) continue
    const evs = evMapA.get(pred.match_id) ?? []
    matchMap.set(pred.match_id, {
      matchId: pred.match_id,
      kickoffAt: m.kickoff_at,
      homeTeam: m.home_team?.name ?? '',
      awayTeam: m.away_team?.name ?? '',
      homeFlagUrl: m.home_team?.flag_url ?? null,
      awayFlagUrl: m.away_team?.flag_url ?? null,
      homeScore: m.home_score,
      awayScore: m.away_score,
      userA: {
        prediction: `${pred.predicted_home ?? '?'}-${pred.predicted_away ?? '?'}`,
        points: evs.reduce((s: number, e: EventEntry) => s + (e.points ?? 0), 0),
        events: evs,
      },
      userB: null,
    })
  }

  for (const pred of predsB) {
    const m = pred.match as any
    if (!m || !pred.match_id) continue
    const evs = evMapB.get(pred.match_id) ?? []
    const userBData: UserMatchData = {
      prediction: `${pred.predicted_home ?? '?'}-${pred.predicted_away ?? '?'}`,
      points: evs.reduce((s: number, e: EventEntry) => s + (e.points ?? 0), 0),
      events: evs,
    }
    const existing = matchMap.get(pred.match_id)
    if (existing) {
      existing.userB = userBData
    } else {
      matchMap.set(pred.match_id, {
        matchId: pred.match_id,
        kickoffAt: m.kickoff_at,
        homeTeam: m.home_team?.name ?? '',
        awayTeam: m.away_team?.name ?? '',
        homeFlagUrl: m.home_team?.flag_url ?? null,
        awayFlagUrl: m.away_team?.flag_url ?? null,
        homeScore: m.home_score,
        awayScore: m.away_score,
        userA: null,
        userB: userBData,
      })
    }
  }

  const matches = [...matchMap.values()].sort(
    (a, b) => new Date(b.kickoffAt).getTime() - new Date(a.kickoffAt).getTime()
  )

  // W/D/L — only matches where both predicted
  let winsA = 0, winsB = 0, draws = 0
  for (const m of matches) {
    if (!m.userA || !m.userB) continue
    if (m.userA.points > m.userB.points) winsA++
    else if (m.userB.points > m.userA.points) winsB++
    else draws++
  }

  const sortBadges = (badges: any[]) =>
    [...badges].sort((a, b) => {
      const aOrder = BADGE_MAP[a.badge_id] ? RARITY_ORDER[BADGE_MAP[a.badge_id].rarity] : 99
      const bOrder = BADGE_MAP[b.badge_id] ? RARITY_ORDER[BADGE_MAP[b.badge_id].rarity] : 99
      return aOrder - bOrder
    })

  const sortedBadgesA = sortBadges(badgesA)
  const sortedBadgesB = sortBadges(badgesB)

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">

      {/* Back */}
      <Link
        href={`/profile/${id}`}
        className="inline-flex items-center gap-1 text-sm hover:opacity-70 transition-opacity"
        style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}
      >
        <ChevronLeft className="w-4 h-4" />
        Back to {profileB.display_name}&apos;s profile
      </Link>

      {/* Header comparison */}
      <div style={{ background: '#ffffff', border: '1px solid #e0dbd3' }} className="p-6">
        <div className="grid grid-cols-3 gap-4 items-center">

          {/* User A (me) */}
          <div className="text-center">
            <div
              className="w-14 h-14 flex items-center justify-center text-2xl font-bold text-white mx-auto mb-2 flex-shrink-0"
              style={{ background: '#141414', fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              {profileA.display_name.charAt(0).toUpperCase()}
            </div>
            <div
              className="font-bold text-base truncate"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", color: '#141414' }}
            >
              {profileA.display_name}
            </div>
            <div className="text-xs mt-0.5" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
              You
            </div>
            <div
              className="text-2xl font-bold mt-2"
              style={{ color: '#ff5c35', fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              {profileA.total_points ?? 0}
            </div>
            <div className="text-xs" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
              pts · #{rankARes.data?.rank ?? '—'}
            </div>
          </div>

          {/* W/D/L */}
          <div className="text-center">
            <div className="text-xs uppercase tracking-wider mb-2" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
              Head to Head
            </div>
            <div className="flex items-center justify-center gap-2">
              <span
                className="text-3xl font-bold"
                style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  color: winsA > winsB ? '#ff5c35' : '#141414',
                }}
              >
                {winsA}
              </span>
              <div className="text-center">
                <div className="text-lg font-bold" style={{ color: '#9b9488', fontFamily: "'Playfair Display', Georgia, serif" }}>
                  {draws}
                </div>
                <div className="text-xs" style={{ color: '#9b9488', fontFamily: 'Inter, sans-serif' }}>draws</div>
              </div>
              <span
                className="text-3xl font-bold"
                style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  color: winsB > winsA ? '#ff5c35' : '#141414',
                }}
              >
                {winsB}
              </span>
            </div>
            <div className="text-xs mt-1" style={{ color: '#9b9488', fontFamily: 'Inter, sans-serif' }}>
              {winsA + winsB + draws} matches played
            </div>
          </div>

          {/* User B */}
          <div className="text-center">
            <div
              className="w-14 h-14 flex items-center justify-center text-2xl font-bold text-white mx-auto mb-2 flex-shrink-0"
              style={{ background: '#141414', fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              {profileB.display_name.charAt(0).toUpperCase()}
            </div>
            <div
              className="font-bold text-base truncate"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", color: '#141414' }}
            >
              {profileB.display_name}
            </div>
            {profileB.favourite_team?.flag_url && (
              <div className="flex justify-center mt-0.5">
                <img src={profileB.favourite_team.flag_url} alt="" className="w-6 h-4 object-contain" />
              </div>
            )}
            <div
              className="text-2xl font-bold mt-2"
              style={{ color: '#ff5c35', fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              {profileB.total_points ?? 0}
            </div>
            <div className="text-xs" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
              pts · #{rankBRes.data?.rank ?? '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Badges comparison */}
      {(sortedBadgesA.length > 0 || sortedBadgesB.length > 0) && (
        <div style={{ background: '#ffffff', border: '1px solid #e0dbd3' }} className="p-5">
          <h2
            className="text-lg mb-4 pb-2"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, color: '#141414', borderBottom: '1px solid #e0dbd3' }}
          >
            Badges
          </h2>
          <div className="grid grid-cols-2 gap-6">
            {/* A badges */}
            <div>
              <div className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
                {profileA.display_name}
              </div>
              {sortedBadgesA.length === 0 ? (
                <p className="text-xs" style={{ color: '#9b9488', fontFamily: 'Inter, sans-serif' }}>No badges yet</p>
              ) : (
                <div className="space-y-1.5">
                  {sortedBadgesA.map((b: any) => {
                    const def = BADGE_MAP[b.badge_id]
                    if (!def) return null
                    return (
                      <div key={b.badge_id} className="flex items-center gap-2 px-2 py-1.5" style={{ background: '#faf9f6', border: '1px solid #e0dbd3' }}>
                        <span className="text-base flex-shrink-0">
                          {b.badge_id === 'twelfth_man' && (profileA as any).favourite_team?.flag_url
                            ? <img src={(profileA as any).favourite_team.flag_url} alt="" className="w-5 h-3.5 object-contain" />
                            : def.emoji}
                        </span>
                        <span className="text-xs font-semibold truncate" style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}>
                          {def.name}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            {/* B badges */}
            <div>
              <div className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
                {profileB.display_name}
              </div>
              {sortedBadgesB.length === 0 ? (
                <p className="text-xs" style={{ color: '#9b9488', fontFamily: 'Inter, sans-serif' }}>No badges yet</p>
              ) : (
                <div className="space-y-1.5">
                  {sortedBadgesB.map((b: any) => {
                    const def = BADGE_MAP[b.badge_id]
                    if (!def) return null
                    return (
                      <div key={b.badge_id} className="flex items-center gap-2 px-2 py-1.5" style={{ background: '#faf9f6', border: '1px solid #e0dbd3' }}>
                        <span className="text-base flex-shrink-0">
                          {b.badge_id === 'twelfth_man' && (profileB as any).favourite_team?.flag_url
                            ? <img src={(profileB as any).favourite_team.flag_url} alt="" className="w-5 h-3.5 object-contain" />
                            : def.emoji}
                        </span>
                        <span className="text-xs font-semibold truncate" style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}>
                          {def.name}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Match by match */}
      <div style={{ background: '#ffffff', border: '1px solid #e0dbd3' }}>
        {/* Section header */}
        <div
          className="px-5 py-3 flex items-center"
          style={{ borderBottom: '1px solid #e0dbd3' }}
        >
          <h2
            className="text-lg flex-1"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, color: '#141414' }}
          >
            Match by Match
          </h2>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-2 px-0" style={{ borderBottom: '2px solid #e0dbd3' }}>
          <div
            className="px-4 py-2 text-xs font-semibold uppercase tracking-wider"
            style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif', borderRight: '1px solid #e0dbd3' }}
          >
            {profileA.display_name} (you)
          </div>
          <div
            className="px-4 py-2 text-xs font-semibold uppercase tracking-wider"
            style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}
          >
            {profileB.display_name}
          </div>
        </div>

        {matches.length === 0 && (
          <p className="px-5 py-8 text-center text-sm" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
            No completed matches yet.
          </p>
        )}

        {matches.map((match) => {
          const ptA = match.userA?.points ?? 0
          const ptB = match.userB?.points ?? 0
          const aWon = match.userA !== null && match.userB !== null && ptA > ptB
          const bWon = match.userA !== null && match.userB !== null && ptB > ptA

          return (
            <div key={match.matchId} style={{ borderBottom: '1px solid #e0dbd3' }}>

              {/* Match header row */}
              <div
                className="px-4 py-2 flex items-center justify-center gap-2 text-sm"
                style={{ background: '#faf9f6', borderBottom: '1px solid #e0dbd3' }}
              >
                {match.homeFlagUrl && (
                  <img src={match.homeFlagUrl} alt="" className="w-5 h-3.5 object-contain flex-shrink-0" />
                )}
                <span style={{ color: '#141414', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>
                  {match.homeTeam}
                </span>
                <span
                  className="font-bold px-2"
                  style={{ color: match.homeScore != null ? '#141414' : '#9b9488', fontFamily: "'Playfair Display', Georgia, serif" }}
                >
                  {match.homeScore ?? '?'} – {match.awayScore ?? '?'}
                </span>
                <span style={{ color: '#141414', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>
                  {match.awayTeam}
                </span>
                {match.awayFlagUrl && (
                  <img src={match.awayFlagUrl} alt="" className="w-5 h-3.5 object-contain flex-shrink-0" />
                )}
              </div>

              {/* Predictions side by side */}
              <div className="grid grid-cols-2">
                {/* User A */}
                <div
                  className="px-4 py-3"
                  style={{
                    borderRight: '1px solid #e0dbd3',
                    background: aWon ? '#f0fdf4' : 'transparent',
                  }}
                >
                  {match.userA ? (
                    <>
                      <div className="flex items-center gap-2">
                        <span
                          className="text-sm font-bold"
                          style={{
                            fontFamily: "'Playfair Display', Georgia, serif",
                            color: ptA > 0 ? '#ff5c35' : '#9b9488',
                          }}
                        >
                          {ptA > 0 ? `+${ptA}` : '0'} pts
                        </span>
                        {aWon && <span className="text-xs">✓</span>}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
                        Predicted {match.userA.prediction}
                      </div>
                      {match.userA.events.map((ev) => (
                        <div key={ev.id} className="text-xs mt-0.5" style={{ color: '#9b9488', fontFamily: 'Inter, sans-serif' }}>
                          {EVENT_LABELS[ev.type] ?? ev.type} +{ev.points}
                        </div>
                      ))}
                    </>
                  ) : (
                    <span className="text-xs italic" style={{ color: '#9b9488', fontFamily: 'Inter, sans-serif' }}>
                      No prediction
                    </span>
                  )}
                </div>

                {/* User B */}
                <div
                  className="px-4 py-3"
                  style={{ background: bWon ? '#f0fdf4' : 'transparent' }}
                >
                  {match.userB ? (
                    <>
                      <div className="flex items-center gap-2">
                        <span
                          className="text-sm font-bold"
                          style={{
                            fontFamily: "'Playfair Display', Georgia, serif",
                            color: ptB > 0 ? '#ff5c35' : '#9b9488',
                          }}
                        >
                          {ptB > 0 ? `+${ptB}` : '0'} pts
                        </span>
                        {bWon && <span className="text-xs">✓</span>}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
                        Predicted {match.userB.prediction}
                      </div>
                      {match.userB.events.map((ev) => (
                        <div key={ev.id} className="text-xs mt-0.5" style={{ color: '#9b9488', fontFamily: 'Inter, sans-serif' }}>
                          {EVENT_LABELS[ev.type] ?? ev.type} +{ev.points}
                        </div>
                      ))}
                    </>
                  ) : (
                    <span className="text-xs italic" style={{ color: '#9b9488', fontFamily: 'Inter, sans-serif' }}>
                      No prediction
                    </span>
                  )}
                </div>
              </div>

            </div>
          )
        })}
      </div>

    </div>
  )
}
