import { createClient } from '@/lib/supabase/server'
import { stageName } from '@/lib/utils'
import type { Match, MatchStage } from '@/types'

export const revalidate = 60

const KNOCKOUT_STAGES: MatchStage[] = ['round_of_32', 'quarter_final', 'semi_final', 'third_place', 'final']

function MatchNode({ match, userPick }: { match: Match; userPick?: { h: number; a: number } }) {
  const finished = match.status === 'finished'
  const hasTeams = match.home_team && match.away_team

  return (
    <div
      className="min-w-[160px] text-xs"
      style={{ border: '1px solid #e0dbd3', background: '#ffffff' }}
    >
      {/* Home */}
      <div
        className="flex items-center gap-1.5 px-3 py-2"
        style={{
          borderBottom: '1px solid #e0dbd3',
          fontFamily: 'Inter, sans-serif',
          color: finished && match.home_score! > match.away_score! ? '#141414' : '#6b6b6b',
          fontWeight: finished && match.home_score! > match.away_score! ? 600 : 400
        }}
      >
        {match.home_team?.flag_url && (
          <img src={match.home_team.flag_url} alt="" className="w-4 h-3 object-cover flex-shrink-0" />
        )}
        <span className="truncate flex-1">{match.home_team?.name ?? 'TBD'}</span>
        {finished && (
          <span className="ml-auto font-bold" style={{ color: '#ff5c35' }}>{match.home_score}</span>
        )}
      </div>
      {/* Away */}
      <div
        className="flex items-center gap-1.5 px-3 py-2"
        style={{
          fontFamily: 'Inter, sans-serif',
          color: finished && match.away_score! > match.home_score! ? '#141414' : '#6b6b6b',
          fontWeight: finished && match.away_score! > match.home_score! ? 600 : 400,
          borderBottom: userPick && hasTeams ? '1px solid #e0dbd3' : 'none'
        }}
      >
        {match.away_team?.flag_url && (
          <img src={match.away_team.flag_url} alt="" className="w-4 h-3 object-cover flex-shrink-0" />
        )}
        <span className="truncate flex-1">{match.away_team?.name ?? 'TBD'}</span>
        {finished && (
          <span className="ml-auto font-bold" style={{ color: '#ff5c35' }}>{match.away_score}</span>
        )}
      </div>
      {/* User pick */}
      {userPick && hasTeams && (
        <div className="px-3 py-1.5" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
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

      {/* Page header */}
      <div className="mb-8 pb-3" style={{ borderBottom: '2px solid #141414' }}>
        <h1
          className="text-4xl mb-1"
          style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 900, color: '#141414' }}
        >
          Tournament Bracket
        </h1>
        <p className="text-xs uppercase tracking-wider" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
          Knockout stage &mdash; your picks vs. reality
        </p>
      </div>

      <div className="overflow-x-auto pb-4">
        <div className="flex gap-6 min-w-max">
          {KNOCKOUT_STAGES.map(stage => {
            const stageMatches = byStage.get(stage) ?? []
            return (
              <div key={stage} className="flex flex-col">
                <h2
                  className="text-xs font-bold uppercase tracking-wider mb-3 text-center pb-2"
                  style={{ color: '#141414', fontFamily: 'Inter, sans-serif', borderBottom: '1px solid #e0dbd3' }}
                >
                  {stageName(stage)}
                </h2>
                <div className="flex flex-col gap-3 justify-around flex-1">
                  {stageMatches.length > 0 ? stageMatches.map(match => (
                    <MatchNode key={match.id} match={match} userPick={predMap.get(match.id)} />
                  )) : (
                    <div
                      className="text-center text-xs px-4 py-8"
                      style={{ color: '#e0dbd3', fontFamily: 'Inter, sans-serif' }}
                    >
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
        <div
          className="text-center py-16 text-sm"
          style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}
        >
          The knockout bracket will appear once the group stage is complete.
        </div>
      )}
    </div>
  )
}
