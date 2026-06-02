import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchMatchResult, mapStatus } from '@/lib/api-football/client'
import { processMatchResult, processFinalistPicks } from '@/lib/points/engine'

// This endpoint is called by Vercel Cron every 10 minutes.
// It checks for matches that should be finished and fetches their results.

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  // Guard: CRON_SECRET must be configured
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }

  // Verify cron secret (set CRON_SECRET in env)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return await runSync()
}

export async function POST() {
  // Admin manual trigger — no secret required (protected by admin middleware)
  return await runSync()
}

async function runSync() {
  const supabase = createServiceClient()
  const now = new Date()

  // Find matches that should be finished but haven't been processed yet
  // Group stage: 95 min after kickoff
  // Knockout: 145 min after kickoff (covers ET + pens buffer)
  const { data: pendingMatches } = await supabase
    .from('matches')
    .select('*')
    .neq('status', 'finished')
    .neq('status', 'cancelled')
    .neq('status', 'postponed')  // (M5) skip postponed matches
    .not('api_id', 'is', null)
    .not('home_team_id', 'is', null)
    .lte('kickoff_at', now.toISOString())
    .order('kickoff_at', { ascending: true })  // (C4) process in chronological order

  if (!pendingMatches?.length) {
    return NextResponse.json({ message: 'No pending matches', processed: 0 })
  }

  let processed = 0
  const errors: string[] = []

  for (const match of pendingMatches) {
    const kickoff = new Date(match.kickoff_at)
    const minutesSinceKickoff = (now.getTime() - kickoff.getTime()) / 60000
    const isKnockout = match.stage !== 'group'

    // Only fetch if enough time has passed (buffer for full time + stoppages)
    const minWait = isKnockout ? 145 : 95
    if (minutesSinceKickoff < minWait) continue

    try {
      const result = await fetchMatchResult(match.api_id)
      if (!result) continue

      const status = mapStatus(result.status)

      if (status === 'finished') {
        // (C3) Skip if scores are null — don't mark finished without real data
        if (result.homeScore === null || result.awayScore === null) continue

        // Store goals
        for (const event of result.events ?? []) {
          if (event.type !== 'Goal') continue

          // (C5) Skip penalty shootout goals (elapsed > 120) — they don't earn scorer bonuses
          // We still receive and could store them but they should not count for bonuses
          if ((event.time?.elapsed ?? 0) > 120) continue

          const { data: team } = await supabase
            .from('teams')
            .select('id')
            .eq('api_id', event.team?.id)
            .single()

          if (!team) continue

          // Always upsert scorer into api_players (records who scored even if unlinked)
          if (event.player?.id) {
            await supabase.from('api_players').upsert({
              api_id:  event.player.id,
              name:    event.player.name ?? '',
              team_id: team.id,
            }, { onConflict: 'api_id' })
          }

          // Look up the text-file player via the link (players.api_id)
          let playerDbId: string | null = null
          if (event.player?.id) {
            const { data: linkedPlayer } = await supabase
              .from('players')
              .select('id')
              .eq('api_id', event.player.id)
              .maybeSingle()
            playerDbId = linkedPlayer?.id ?? null
          }

          await supabase.from('goal_events').upsert({
            api_id:           event.id,
            match_id:         match.id,
            player_id:        playerDbId,                        // null if player not yet linked
            api_player_api_id: event.player?.id ?? null,         // always stored
            team_id:          team.id,
            minute:           event.time?.elapsed ?? null,
            is_own_goal:      event.detail === 'Own Goal',
            is_penalty:       event.detail === 'Penalty',
          }, { onConflict: 'api_id', ignoreDuplicates: true })
        }

        // Update match score
        await supabase.from('matches').update({
          home_score: result.homeScore,
          away_score: result.awayScore,
          status: 'finished',
          result_fetched_at: now.toISOString(),
        }).eq('id', match.id)

        // Award points
        const { processed: p } = await processMatchResult(match.id)
        processed += p

        // (N5 / Auto Crystal Ball) If this is the final or third_place match,
        // attempt to automatically process finalist picks once both matches are done
        if (match.stage === 'final' || match.stage === 'third_place') {
          await maybeProcessFinalistPicks(supabase, result)
        }
      } else {
        // Update status only
        await supabase.from('matches').update({ status }).eq('id', match.id)
      }
    } catch (err: any) {
      errors.push(`Match ${match.id}: ${err.message}`)
    }
  }

  return NextResponse.json({
    message: `Synced ${pendingMatches.length} matches, processed ${processed} predictions`,
    processed,
    errors: errors.length ? errors : undefined,
  })
}

// ============================================================
// Auto Crystal Ball — triggers processFinalistPicks once both
// the Final and 3rd-place match are recorded as finished.
// Safe to call multiple times — processFinalistPicks only
// processes picks that haven't been awarded yet.
// ============================================================

async function maybeProcessFinalistPicks(
  supabase: ReturnType<typeof import('@/lib/supabase/server').createServiceClient>,
  currentResult: { penaltyHome: number | null; penaltyAway: number | null; homeScore: number | null; awayScore: number | null }
) {
  // Fetch the finished Final from DB
  const { data: finalMatch } = await supabase
    .from('matches')
    .select('id, home_team_id, away_team_id, home_score, away_score')
    .eq('stage', 'final')
    .eq('status', 'finished')
    .single()

  if (!finalMatch) return // Final not finished yet

  // Fetch the finished 3rd-place match from DB
  const { data: thirdMatch } = await supabase
    .from('matches')
    .select('id, home_team_id, away_team_id, home_score, away_score')
    .eq('stage', 'third_place')
    .eq('status', 'finished')
    .single()

  if (!thirdMatch) return // 3rd-place match not finished yet

  // Determine winner and runner-up from the Final
  const { home_team_id: fHomeId, away_team_id: fAwayId, home_score: fHomeScore, away_score: fAwayScore } = finalMatch
  if (fHomeId === null || fAwayId === null || fHomeScore === null || fAwayScore === null) return

  let winnerId: string
  let runnerId: string

  if (fHomeScore > fAwayScore) {
    winnerId = fHomeId
    runnerId = fAwayId
  } else if (fAwayScore > fHomeScore) {
    winnerId = fAwayId
    runnerId = fHomeId
  } else {
    // Scores level — use penalty scores from the API result
    // currentResult.penaltyHome/Away may be populated if this call came from the Final itself
    // otherwise fetch them from the DB (we don't store penalties, so rely on the in-memory result)
    if (currentResult.penaltyHome !== null && currentResult.penaltyAway !== null) {
      winnerId = currentResult.penaltyHome > currentResult.penaltyAway ? fHomeId : fAwayId
      runnerId = currentResult.penaltyHome > currentResult.penaltyAway ? fAwayId : fHomeId
    } else {
      // Cannot determine winner — skip for now (cron will retry)
      return
    }
  }

  // Determine 3rd-place team from the third_place match
  const { home_team_id: tHomeId, away_team_id: tAwayId, home_score: tHomeScore, away_score: tAwayScore } = thirdMatch
  if (tHomeId === null || tAwayId === null || tHomeScore === null || tAwayScore === null) return

  let thirdId: string
  if (tHomeScore > tAwayScore) {
    thirdId = tHomeId
  } else if (tAwayScore > tHomeScore) {
    thirdId = tAwayId
  } else {
    // Scores level — use penalty scores from the API result if this call came from the 3rd-place match
    if (currentResult.penaltyHome !== null && currentResult.penaltyAway !== null) {
      thirdId = currentResult.penaltyHome > currentResult.penaltyAway ? tHomeId : tAwayId
    } else {
      // Cannot determine winner — skip for now (cron will retry)
      return
    }
  }

  await processFinalistPicks(winnerId, runnerId, thirdId)
}
