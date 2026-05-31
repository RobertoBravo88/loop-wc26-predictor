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

      {/* Page header */}
      <div className="mb-6 pb-3" style={{ borderBottom: '2px solid #141414' }}>
        <h1
          className="text-4xl mb-1"
          style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 900, color: '#141414' }}
        >
          My Predictions
        </h1>
        <p className="text-xs uppercase tracking-wider" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
          Predictions lock at kick-off &middot; Exact score = 100pts &middot; Correct outcome = 50pts
        </p>
      </div>

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
              <h2
                className="text-lg mb-3 pb-2 flex items-center gap-2"
                style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontWeight: 700,
                  color: '#141414',
                  borderBottom: '1px solid #e0dbd3'
                }}
              >
                <span
                  className="w-6 h-6 flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: '#141414', fontFamily: 'Inter, sans-serif' }}
                >
                  {group}
                </span>
                Group {group}
              </h2>
              <div style={{ border: '1px solid #e0dbd3' }}>
                {groupMatches.map((match, idx) => (
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
            <h2
              className="text-lg mb-3 pb-2"
              style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontWeight: 700,
                color: '#141414',
                borderBottom: '1px solid #e0dbd3'
              }}
            >
              {stageName(stage)}
            </h2>
            <div style={{ border: '1px solid #e0dbd3' }}>
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
        <div className="text-center py-16 text-sm" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
          Fixtures haven&apos;t been loaded yet. Check back soon!
        </div>
      )}
    </div>
  )
}
