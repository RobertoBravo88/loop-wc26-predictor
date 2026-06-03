import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchMatchResult, mapStatus } from '@/lib/api-football/client'

// Called by external cron (cron-job.org) every 2 minutes.
// Fetches live scores and goal events for any match currently in progress.
// Does NOT process points — that happens in sync-results at 9 AM UTC daily.

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return await runLiveSync()
}

export async function POST() {
  // Admin manual trigger — no secret required (protected by admin middleware)
  return await runLiveSync()
}

async function runLiveSync() {
  const supabase = createServiceClient()
  const now = new Date()

  // Find matches that have kicked off in the last 3 hours and aren't finished yet.
  // 3 hours covers the longest possible match (90 min + ET + penalties + stoppage).
  const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString()

  const { data: liveMatches } = await supabase
    .from('matches')
    .select('*')
    .neq('status', 'finished')
    .neq('status', 'cancelled')
    .neq('status', 'postponed')
    .not('api_id', 'is', null)
    .not('home_team_id', 'is', null)
    .lte('kickoff_at', now.toISOString())
    .gte('kickoff_at', threeHoursAgo)
    .order('kickoff_at', { ascending: true })

  if (!liveMatches?.length) {
    return NextResponse.json({ message: 'No live matches', updated: 0 })
  }

  let updated = 0
  const errors: string[] = []

  for (const match of liveMatches) {
    try {
      const result = await fetchMatchResult(match.api_id)
      if (!result) continue

      const status = mapStatus(result.status)

      // Always update score and status — even if still in play
      if (result.homeScore !== null && result.awayScore !== null) {
        await supabase.from('matches').update({
          home_score: result.homeScore,
          away_score: result.awayScore,
          status,
        }).eq('id', match.id)
      } else {
        // No score yet — just update status
        await supabase.from('matches').update({ status }).eq('id', match.id)
      }

      // Upsert goal events so Match Centre can show scorers in real time.
      // result_fetched_at is intentionally NOT set here — sync-results sets
      // that after processing points, so it stays the "points processed" marker.
      for (const event of result.events ?? []) {
        if (event.type !== 'Goal') continue

        // Skip penalty shootout goals (elapsed > 120)
        if ((event.time?.elapsed ?? 0) > 120) continue

        const { data: team } = await supabase
          .from('teams')
          .select('id')
          .eq('api_id', event.team?.id)
          .single()

        if (!team) continue

        // Upsert scorer into api_players
        if (event.player?.id) {
          await supabase.from('api_players').upsert({
            api_id:  event.player.id,
            name:    event.player.name ?? '',
            team_id: team.id,
          }, { onConflict: 'api_id' })
        }

        // Look up linked player
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
          api_id:            event.id,
          match_id:          match.id,
          player_id:         playerDbId,
          api_player_api_id: event.player?.id ?? null,
          team_id:           team.id,
          minute:            event.time?.elapsed ?? null,
          is_own_goal:       event.detail === 'Own Goal',
          is_penalty:        event.detail === 'Penalty',
        }, { onConflict: 'api_id', ignoreDuplicates: true })
      }

      updated++
    } catch (err: any) {
      errors.push(`Match ${match.id}: ${err.message}`)
    }
  }

  return NextResponse.json({
    message: `Live sync: updated ${updated} of ${liveMatches.length} matches`,
    updated,
    errors: errors.length ? errors : undefined,
  })
}
