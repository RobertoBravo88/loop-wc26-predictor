import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchMatchResult, mapStatus } from '@/lib/api-football/client'
import { processMatchResult } from '@/lib/points/engine'

// This endpoint is called by Vercel Cron every 10 minutes.
// It checks for matches that should be finished and fetches their results.

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
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
    .not('api_id', 'is', null)
    .not('home_team_id', 'is', null)
    .lte('kickoff_at', now.toISOString())

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
        // Store goals
        for (const event of result.events ?? []) {
          if (event.type !== 'Goal') continue

          const { data: team } = await supabase
            .from('teams')
            .select('id')
            .eq('api_id', event.team?.id)
            .single()

          if (!team) continue

          // Look up player — auto-create if not in DB yet (handles late squad additions
          // and the June 11+ switch to stats-based player IDs)
          let playerDbId: string | null = null
          if (event.player?.id) {
            const { data: existingPlayer } = await supabase
              .from('players')
              .select('id')
              .eq('api_id', event.player.id)
              .single()

            if (existingPlayer) {
              playerDbId = existingPlayer.id
            } else if (event.player?.name) {
              // Player not in DB — create them so the goal is always linked
              const { data: newPlayer } = await supabase
                .from('players')
                .upsert({
                  api_id: event.player.id,
                  name: event.player.name,
                  team_id: team.id,
                }, { onConflict: 'api_id' })
                .select('id')
                .single()
              playerDbId = newPlayer?.id ?? null
            }
          }

          await supabase.from('goal_events').upsert({
            api_id: event.id,
            match_id: match.id,
            player_id: playerDbId,
            team_id: team.id,
            minute: event.time?.elapsed ?? null,
            is_own_goal: event.detail === 'Own Goal',
            is_penalty: event.detail === 'Penalty',
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
