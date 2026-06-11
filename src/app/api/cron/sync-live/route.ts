import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchMatchResult, mapStatus } from '@/lib/api-football/client'

// Called every 2 minutes by Vercel Cron during matches.
// Updates live scores and status for in-progress matches.
// Point awards are NOT made here — the post-match cron handles that.

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
  return await runLiveSync()
}

async function runLiveSync() {
  const supabase = createServiceClient()
  const now = new Date()

  // Find matches that should currently be in progress:
  // kicked off within the last 150 minutes and not yet finished
  const minus150 = new Date(now.getTime() - 150 * 60 * 1000).toISOString()

  const { data: liveMatches } = await supabase
    .from('matches')
    .select('*')
    .in('status', ['scheduled', 'in_play'])
    .not('api_id', 'is', null)
    .not('home_team_id', 'is', null)
    .lte('kickoff_at', now.toISOString())
    .gte('kickoff_at', minus150)
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

      // Update score and status
      await supabase.from('matches').update({
        status,
        home_score: result.homeScore ?? match.home_score,
        away_score: result.awayScore ?? match.away_score,
      }).eq('id', match.id)

      // Upsert goal events so Match Centre can show scorers live
      for (const event of result.events ?? []) {
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

        // API Football events have no unique ID, so check before inserting
        const minute = event.time?.elapsed ?? null
        const isOwnGoal = event.detail === 'Own Goal'
        const { data: existingGoal } = await supabase
          .from('goal_events')
          .select('id')
          .eq('match_id', match.id)
          .eq('team_id', team.id)
          .eq('minute', minute)
          .eq('is_own_goal', isOwnGoal)
          .maybeSingle()

        if (!existingGoal) {
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

      updated++
    } catch (err: any) {
      errors.push(`Match ${match.id}: ${err.message}`)
    }
  }

  return NextResponse.json({
    message: `Updated ${updated} live matches`,
    updated,
    errors: errors.length ? errors : undefined,
  })
}
