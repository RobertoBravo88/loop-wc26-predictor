import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchMatchResult, mapStatus } from '@/lib/api-football/client'
import { processMatchResult } from '@/lib/points/engine'

// Called every 2 minutes by cron-job.org.
// Handles both live score updates and end-of-match point awards in one pass.

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return await runSync()
}

export async function POST() {
  return await runSync()
}

async function runSync() {
  const supabase = createServiceClient()
  const now = new Date()

  // Find all matches that have kicked off but aren't finished yet.
  // 210 min window covers group (90+stoppages) and knockout (120+ET+pens).
  const minus210 = new Date(now.getTime() - 210 * 60 * 1000).toISOString()

  const { data: activeMatches } = await supabase
    .from('matches')
    .select('*')
    .in('status', ['scheduled', 'in_play'])
    .not('api_id', 'is', null)
    .not('home_team_id', 'is', null)
    .lte('kickoff_at', now.toISOString())
    .gte('kickoff_at', minus210)
    .order('kickoff_at', { ascending: true })

  if (!activeMatches?.length) {
    return NextResponse.json({ message: 'No active matches', updated: 0 })
  }

  let updated = 0
  let finished = 0
  const errors: string[] = []

  for (const match of activeMatches) {
    try {
      const result = await fetchMatchResult(match.api_id)
      if (!result) continue

      const status = mapStatus(result.status)

      if (status === 'finished') {
        if (result.homeScore === null || result.awayScore === null) continue

        // On FT: delete all live goal_events and re-insert from authoritative final data.
        // During live play the API returns time.elapsed as the running clock (e.g. 50 for
        // a 45+5' goal). After FT it resets to the canonical base minute (45). Deleting
        // first means processMatchResult always runs on clean, deduplicated data.
        await supabase.from('goal_events').delete().eq('match_id', match.id)
        await syncGoalEvents(supabase, match, result.events ?? [])

        await supabase.from('matches').update({
          status: 'finished',
          home_score: result.homeScore,
          away_score: result.awayScore,
          result_fetched_at: now.toISOString(),
        }).eq('id', match.id)

        await processMatchResult(match.id)
        finished++
      } else {
        // Live — best-effort goal sync for Match Centre display.
        // Minor minute inaccuracies are corrected at FT by the delete+re-insert above.
        await syncGoalEvents(supabase, match, result.events ?? [])

        await supabase.from('matches').update({
          status,
          home_score: result.homeScore ?? match.home_score,
          away_score: result.awayScore ?? match.away_score,
        }).eq('id', match.id)
      }

      updated++
    } catch (err: any) {
      errors.push(`Match ${match.id}: ${err.message}`)
    }
  }

  return NextResponse.json({
    message: `Updated ${updated} matches, ${finished} finished`,
    updated,
    finished,
    errors: errors.length ? errors : undefined,
  })
}

async function syncGoalEvents(supabase: any, match: any, events: any[]) {
  for (const event of events) {
    if (event.type !== 'Goal') continue
    if ((event.time?.elapsed ?? 0) > 120) continue

    const { data: team } = await supabase
      .from('teams')
      .select('id')
      .eq('api_id', event.team?.id)
      .single()

    if (!team) continue

    if (event.player?.id) {
      await supabase.from('api_players').upsert({
        api_id:  event.player.id,
        name:    event.player.name ?? '',
        team_id: team.id,
      }, { onConflict: 'api_id' })
    }

    let playerDbId: string | null = null
    if (event.player?.id) {
      const { data: linkedPlayer } = await supabase
        .from('players')
        .select('id')
        .eq('api_id', event.player.id)
        .maybeSingle()
      playerDbId = linkedPlayer?.id ?? null
    }

    // API Football events have no unique ID — check before inserting to avoid duplicates
    const minute = event.time?.elapsed ?? null
    const isOwnGoal = event.detail === 'Own Goal'
    const { data: existing } = await supabase
      .from('goal_events')
      .select('id')
      .eq('match_id', match.id)
      .eq('team_id', team.id)
      .eq('minute', minute)
      .eq('is_own_goal', isOwnGoal)
      .maybeSingle()

    if (!existing) {
      await supabase.from('goal_events').insert({
        match_id:          match.id,
        player_id:         playerDbId,
        api_player_api_id: event.player?.id ?? null,
        team_id:           team.id,
        minute,
        is_own_goal:       isOwnGoal,
        is_penalty:        event.detail === 'Penalty',
      })
    }
  }
}
