import { createClient } from '@/lib/supabase/server'
import { stageName } from '@/lib/utils'
import type { Match, MatchStage } from '@/types'

export const revalidate = 60

const KNOCKOUT_STAGES: MatchStage[] = ['round_of_32', 'quarter_final', 'semi_final', 'third_place', 'final']

function MatchNode({ match, userPick }: { match: Match; userPick?: { h: number; a: number } }) {
  const finished = match.status === 'finished'
  const hasTeams = match.home_team && match.away_team

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3 min-w-[160px] text-xs shadow-sm">
      {/* Home */}
      <div className={`flex items-center gap-1.5 mb-1 ${finished && match.home_score! > match.away_score! ? 'font-bold text-gray-900' : 'text-gray-500'}`}>
        {match.home_team?.flag_url && <img src={match.home_team.flag_url} alt="" className="w-4 h-3 object-cover rounded-sm flex-shrink-0" />}
        <span className="truncate">{match.home_team?.name ?? 'TBD'}</span>
        {finished && <span className="ml-auto font-bold">{match.home_score}</span>}
      </div>
      {/* Away */}
      <div className={`flex items-center gap-1.5 ${finished && match.away_score! > match.home_score! ? 'font-bold text-gray-900' : 'text-gray-500'}`}>
        {match.away_team?.flag_url && <img src={match.away_team.flag_url} alt="" className="w-4 h-3 object-cover rounded-sm flex-shrink-0" />}
        <span className="truncate">{match.away_team?.name ?? 'TBD'}</span>
        {finished && <span className="ml-auto font-bold">{match.away_score}</span>}
      </div>
      {/* User pick */}
      {userPick && hasTeams && (
        <div className="mt-1.5 pt-1.5 border-t border-gray-50 text-gray-400">
          Your pick: {userPick.h}–{userPick.a}
        </div>
      )}
    </div>
  )
}

export default async function BracketPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: matches } = await supabase
    .from('matches')
    .select('*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*)')
    .in('stage', KNOCKOUT_STAGES)
    .order('kickoff_at')

  const predMap = new Map<string, { h: number; a: number }>()
  if (user) {
    const ids = (matches ?? []).map(m => m.id)
    const { data: preds } = await supabase
      .from('predictions')
      .select('match_id, predicted_home, predicted_away')
      .eq('user_id', user.id)
      .in('match_id', ids)
    for (const p of preds ?? []) predMap.set(p.match_id, { h: p.predicted_home, a: p.predicted_away })
  }

  const byStage = new Map<MatchStage, Match[]>()
  for (const m of (matches as Match[] ?? [])) {
    if (!byStage.has(m.stage)) byStage.set(m.stage, [])
    byStage.get(m.stage)!.push(m)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Tournament Bracket</h1>
      <p className="text-sm text-gray-500 mb-8">Knockout stage — your picks vs. reality.</p>

      <div className="overflow-x-auto pb-4">
        <div className="flex gap-8 min-w-max">
          {KNOCKOUT_STAGES.map(stage => {
            const stageMatches = byStage.get(stage) ?? []
            return (
              <div key={stage} className="flex flex-col">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3 text-center">
                  {stageName(stage)}
                </h2>
                <div className="flex flex-col gap-3 justify-around flex-1">
                  {stageMatches.length > 0 ? stageMatches.map(match => (
                    <MatchNode key={match.id} match={match} userPick={predMap.get(match.id)} />
                  )) : (
                    <div className="text-center text-xs text-gray-300 px-4 py-8">
                      Fixtures TBD
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {!matches?.length && (
        <div className="text-center py-16 text-gray-400 text-sm">
          The knockout bracket will appear once the group stage is complete.
        </div>
      )}
    </div>
  )
}
