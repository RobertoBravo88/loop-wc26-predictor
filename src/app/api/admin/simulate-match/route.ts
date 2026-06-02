import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { POINTS } from '@/types'

export const dynamic = 'force-dynamic'

/**
 * Dry-run match result simulation — NO database writes.
 * Given a match ID and hypothetical scores, calculates what points
 * every user with a prediction would earn, including streak bonuses.
 */
export async function POST(req: NextRequest) {
  // Auth — admin only
  const caller = await createClient()
  const { data: { user } } = await caller.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: p } = await caller.from('profiles').select('role').eq('id', user.id).single()
  if (p?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { matchId, homeScore, awayScore } = await req.json()
  if (!matchId || homeScore == null || awayScore == null) {
    return NextResponse.json({ error: 'matchId, homeScore and awayScore are required' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Fetch match
  const { data: match } = await supabase
    .from('matches')
    .select('*, home_team:teams!home_team_id(name), away_team:teams!away_team_id(name)')
    .eq('id', matchId)
    .single()

  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })

  // Fetch all predictions + user info for this match
  const { data: predictions } = await supabase
    .from('predictions')
    .select('*, profile:profiles(id, display_name, current_streak)')
    .eq('match_id', matchId)

  const actualHome = Number(homeScore)
  const actualAway = Number(awayScore)

  const results = (predictions ?? []).map((pred: any) => {
    const isExact = pred.predicted_home === actualHome && pred.predicted_away === actualAway
    const predictedOutcome = Math.sign(pred.predicted_home - pred.predicted_away)
    const actualOutcome    = Math.sign(actualHome - actualAway)
    const isCorrectOutcome = isExact || predictedOutcome === actualOutcome

    const base   = isExact ? POINTS.EXACT_SCORE : isCorrectOutcome ? POINTS.CORRECT_OUTCOME : 0
    const streak = isExact && (pred.profile?.current_streak ?? 0) + 1 >= POINTS.STREAK_STARTS_AT
      ? POINTS.STREAK_BONUS
      : 0
    const total  = base + streak

    return {
      userId:    pred.user_id,
      name:      pred.profile?.display_name ?? 'Unknown',
      predicted: `${pred.predicted_home}–${pred.predicted_away}`,
      isExact,
      isCorrectOutcome,
      base,
      streak,
      total,
      currentStreak: pred.profile?.current_streak ?? 0,
      alreadyProcessed: !!pred.processed_at,
    }
  })

  // Sort: exact first, then correct outcome, then misses
  results.sort((a: any, b: any) => b.total - a.total || a.name.localeCompare(b.name))

  return NextResponse.json({
    match: {
      id:       match.id,
      home:     (match.home_team as any)?.name ?? '?',
      away:     (match.away_team as any)?.name ?? '?',
      simScore: `${actualHome}–${actualAway}`,
    },
    totalPredictions: results.length,
    results,
  })
}
