import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { stageName, isMatchLocked, formatKickoff } from '@/lib/utils'
import PredictionCard from '@/components/predictions/PredictionCard'
import type { Match, Prediction, MatchStage } from '@/types'

export const revalidate = 30

const STAGE_ORDER: MatchStage[] = ['group', 'round_of_32', 'quarter_final', 'semi_final', 'third_place', 'final']

export default async function PredictionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: matches } = await supabase
    .from('matches')
    .select('*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*)')
    .not('home_team_id', 'is', null)
    .not('away_team_id', 'is', null)
    .order('kickoff_at', { ascending: true })

  const { data: predictions } = await supabase
    .from('predictions')
    .select('*')
    .eq('user_id', user.id)

  const predictionMap = new Map<string, Prediction>(
    (predictions ?? []).map(p => [p.match_id, p])
  )

  // Group by stage
  const byStage = new Map<MatchStage, Match[]>()
  for (const match of (matches as Match[] ?? [])) {
    if (!byStage.has(match.stage)) byStage.set(match.stage, [])
    byStage.get(match.stage)!.push(match)
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">My Predictions</h1>
      <p className="text-sm text-gray-500 mb-8">Predictions lock at kick-off. Exact score = 100pts · Correct outcome = 50pts.</p>

      {STAGE_ORDER.map(stage => {
        const stageMatches = byStage.get(stage)
        if (!stageMatches?.length) return null

        // For group stage, sub-group by group letter
        if (stage === 'group') {
          const byGroup = new Map<string, Match[]>()
          for (const m of stageMatches) {
            const g = m.group_letter ?? '?'
            if (!byGroup.has(g)) byGroup.set(g, [])
            byGroup.get(g)!.push(m)
          }
          return Array.from(byGroup.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([group, groupMatches]) => (
            <section key={group} className="mb-8">
              <h2 className="text-base font-bold text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-[#ff5c35] text-white flex items-center justify-center text-xs font-bold">{group}</span>
                Group {group}
              </h2>
              <div className="space-y-3">
                {groupMatches.map(match => (
                  <PredictionCard
                    key={match.id}
                    match={match}
                    prediction={predictionMap.get(match.id) ?? null}
                    userId={user.id}
                  />
                ))}
              </div>
            </section>
          ))
        }

        return (
          <section key={stage} className="mb-8">
            <h2 className="text-base font-bold text-gray-700 mb-3">{stageName(stage)}</h2>
            <div className="space-y-3">
              {stageMatches.map(match => (
                <PredictionCard
                  key={match.id}
                  match={match}
                  prediction={predictionMap.get(match.id) ?? null}
                  userId={user.id}
                />
              ))}
            </div>
          </section>
        )
      })}

      {!matches?.length && (
        <div className="text-center py-16 text-gray-400 text-sm">
          Fixtures haven&apos;t been loaded yet. Check back soon!
        </div>
      )}
    </div>
  )
}
