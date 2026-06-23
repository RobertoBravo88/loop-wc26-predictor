import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchMatchResult } from '@/lib/api-football/client'
import { removeGoalBonus, reprocessGoalBonuses } from '@/lib/points/engine'

export const dynamic    = 'force-dynamic'
export const maxDuration = 300

export async function POST() {
  const supabase = createServiceClient()

  const { data: matches } = await supabase
    .from('matches')
    .select('id, api_id')
    .eq('status', 'finished')
    .not('api_id', 'is', null)

  if (!matches?.length) {
    return NextResponse.json({ message: 'No finished matches to sync', goalsRemoved: 0, goalsAdded: 0 })
  }

  let totalRemoved = 0
  let totalAdded = 0
  let totalPointsReverted = 0
  const errors: string[] = []

  for (const match of matches) {
    try {
      const result = await fetchMatchResult(match.api_id)
      if (!result) continue

      // Only reconcile non-shootout goals (≤ minute 120)
      const apiEvents = (result.events ?? []).filter(
        (e: any) => e.type === 'Goal' && (e.time?.elapsed ?? 0) <= 120
      )

      // Build a set of API goal keys: team_db_id:minute:is_own_goal
      const apiGoalKeys = new Set<string>()
      const apiGoalDetails: Array<{
        teamDbId: string
        minute: number | null
        isOwnGoal: boolean
        isPenalty: boolean
        playerApiId: number | null
        playerName: string | null
      }> = []

      for (const event of apiEvents) {
        const { data: team } = await supabase
          .from('teams')
          .select('id')
          .eq('api_id', event.team?.id)
          .maybeSingle()
        if (!team) continue

        const minute: number | null = event.time?.elapsed ?? null
        const isOwnGoal = event.detail === 'Own Goal'
        const key = `${team.id}:${minute}:${isOwnGoal}`
        apiGoalKeys.add(key)
        apiGoalDetails.push({
          teamDbId:    team.id,
          minute,
          isOwnGoal,
          isPenalty:   event.detail === 'Penalty',
          playerApiId: event.player?.id ?? null,
          playerName:  event.player?.name ?? null,
        })
      }

      // Fetch current DB goals for this match (non-shootout)
      const { data: dbGoals } = await supabase
        .from('goal_events')
        .select('*')
        .eq('match_id', match.id)
        .or('minute.lte.120,minute.is.null')

      if (!dbGoals) continue

      const dbGoalKeys = new Set(
        dbGoals.map((g: any) => `${g.team_id}:${g.minute}:${g.is_own_goal}`)
      )

      // Fetch blocked goal keys for this match (known API phantoms)
      const { data: blockedRows } = await supabase
        .from('blocked_goal_keys')
        .select('team_id, minute, is_own_goal')
        .eq('match_id', match.id)
      const blockedKeys = new Set(
        (blockedRows ?? []).map((b: any) => `${b.team_id}:${b.minute}:${b.is_own_goal}`)
      )

      // 1. Goals in DB but not in API → phantom, revert points and delete
      for (const dbGoal of dbGoals) {
        const key = `${dbGoal.team_id}:${dbGoal.minute}:${dbGoal.is_own_goal}`
        if (!apiGoalKeys.has(key)) {
          const { pointsReverted } = await removeGoalBonus(dbGoal.id)
          await supabase.from('goal_events').delete().eq('id', dbGoal.id)
          totalRemoved++
          totalPointsReverted += pointsReverted
        }
      }

      // 2. Goals in API but not in DB → missing, insert and award bonuses
      //    Skip blocked keys (known API phantoms we've manually removed)
      let addedThisMatch = 0
      for (const { teamDbId, minute, isOwnGoal, isPenalty, playerApiId, playerName } of apiGoalDetails) {
        const key = `${teamDbId}:${minute}:${isOwnGoal}`
        if (!dbGoalKeys.has(key) && !blockedKeys.has(key)) {
          // Upsert into api_players so retroactive linking works
          if (playerApiId) {
            await supabase.from('api_players').upsert({
              api_id:  playerApiId,
              name:    playerName ?? '',
              team_id: teamDbId,
            }, { onConflict: 'api_id' })
          }

          // Resolve to our players table
          let playerDbId: string | null = null
          if (playerApiId) {
            const { data: linked } = await supabase
              .from('players')
              .select('id')
              .eq('api_id', playerApiId)
              .maybeSingle()
            playerDbId = linked?.id ?? null
          }

          await supabase.from('goal_events').insert({
            match_id:          match.id,
            player_id:         playerDbId,
            api_player_api_id: playerApiId,
            team_id:           teamDbId,
            minute,
            is_own_goal:       isOwnGoal,
            is_penalty:        isPenalty,
          })

          addedThisMatch++
          totalAdded++
        }
      }

      // Reprocess bonuses for any newly added goals
      if (addedThisMatch > 0) {
        await reprocessGoalBonuses(match.id)
      }

    } catch (err: any) {
      errors.push(`Match ${match.id}: ${err.message}`)
    }
  }

  return NextResponse.json({
    message: `Synced ${matches.length} matches — removed ${totalRemoved} phantom goals (${totalPointsReverted} pts reverted), added ${totalAdded} missing goals`,
    goalsRemoved: totalRemoved,
    goalsAdded: totalAdded,
    pointsReverted: totalPointsReverted,
    errors: errors.length ? errors : undefined,
  })
}
