import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { stageName, isMatchLocked, isTournamentStarted } from '@/lib/utils'
import { format } from 'date-fns'
import PredictionCard from '@/components/predictions/PredictionCard'
import GroupMatchesList from '@/components/predictions/GroupMatchesList'
import TournamentPicksClient from '@/components/predictions/TournamentPicksClient'
import Link from 'next/link'
import type { Match, Prediction, MatchStage, Team } from '@/types'
import { R32_SLOT_MAP, resolveSlot, type SlotInfo, type GroupLeaders } from '@/lib/bracket/slots'

const GROUPS = ['A','B','C','D','E','F','G','H','I','J','K','L']

function computeGroupLeaders(
  matches: Match[],
  teams: Team[],
): GroupLeaders {
  type Row = { name: string; flagUrl: string | null; pts: number; gd: number; gf: number }
  const table = new Map<string, Row>()
  for (const t of teams) {
    if (!t.group_letter) continue
    table.set(t.id, { name: t.name, flagUrl: t.flag_url, pts: 0, gd: 0, gf: 0 })
  }
  for (const m of matches) {
    if (m.home_score === null || m.away_score === null) continue
    const home = table.get(m.home_team_id!), away = table.get(m.away_team_id!)
    if (!home || !away) continue
    home.gf += m.home_score; home.gd += m.home_score - m.away_score
    away.gf += m.away_score; away.gd += m.away_score - m.home_score
    if (m.home_score > m.away_score) { home.pts += 3 }
    else if (m.home_score < m.away_score) { away.pts += 3 }
    else { home.pts++; away.pts++ }
  }
  const byGroup = new Map<string, { rows: Row[]; matchCount: number; finishedCount: number }>()
  for (const t of teams) {
    if (!t.group_letter) continue
    if (!byGroup.has(t.group_letter)) byGroup.set(t.group_letter, { rows: [], matchCount: 0, finishedCount: 0 })
    const row = table.get(t.id)
    if (row) byGroup.get(t.group_letter)!.rows.push(row)
  }
  for (const m of matches) {
    if (!m.group_letter) continue
    const g = byGroup.get(m.group_letter)
    if (!g) continue
    g.matchCount++
    if (m.status === 'finished') g.finishedCount++
  }
  const result: GroupLeaders = {}
  for (const letter of GROUPS) {
    const g = byGroup.get(letter)
    if (!g) { result[letter] = { complete: false }; continue }
    const sorted = [...g.rows].sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf)
    result[letter] = {
      p1: sorted[0]?.name, p2: sorted[1]?.name,
      p1Flag: sorted[0]?.flagUrl ?? null, p2Flag: sorted[1]?.flagUrl ?? null,
      complete: g.matchCount > 0 && g.matchCount === g.finishedCount,
    }
  }
  return result
}

export const revalidate = 30

const KNOCKOUT_STAGES: MatchStage[] = [
  'round_of_32', 'round_of_16', 'quarter_final', 'semi_final', 'third_place', 'final',
]

export default async function PredictionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const activeTab =
    tab === 'tournament' ? 'tournament' :
    tab === 'matches'    ? 'matches'    :
                           'finals'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // ─────────────────────────────────────────────────────────────────────
  // Always fetch — lightweight data for tab badges
  // ─────────────────────────────────────────────────────────────────────
  const [
    groupMatchesRes,
    knockoutMatchesRes,
    userPredIdsRes,
    finalistCountRes,
    scorerCountRes,
    lastSyncRes,
    secretsCountRes,
    fanDataRes,
  ] = await Promise.all([
    supabase.from('matches').select('id, kickoff_at').eq('stage', 'group').order('kickoff_at'),
    supabase.from('matches').select('id, kickoff_at').in('stage', KNOCKOUT_STAGES).order('kickoff_at'),
    supabase.from('predictions').select('match_id').eq('user_id', user.id),
    supabase.from('finalist_picks')
      .select('first_team_id, second_team_id, third_team_id')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase.from('scorer_picks').select('id').eq('user_id', user.id),
    supabase.from('matches').select('result_fetched_at').not('result_fetched_at', 'is', null).order('result_fetched_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('profiles').select('favourite_team_id, favourite_player_id').eq('id', user.id).maybeSingle(),
    supabase.from('profiles').select('favourite_team_id').not('favourite_team_id', 'is', null),
  ])

  // Build fan count map (team → number of fans)
  const fanCountMap: Record<string, number> = {}
  for (const row of fanDataRes.data ?? []) {
    if (row.favourite_team_id) {
      fanCountMap[row.favourite_team_id] = (fanCountMap[row.favourite_team_id] ?? 0) + 1
    }
  }

  const lastSynced = lastSyncRes.data?.result_fetched_at ?? null

  const allGroupMatches   = groupMatchesRes.data   ?? []
  const allKnockoutMatches = knockoutMatchesRes.data ?? []
  const predSet = new Set((userPredIdsRes.data ?? []).map(p => p.match_id))

  // Group tab badge
  const groupMatchCount = allGroupMatches.length
  const groupPredCount  = allGroupMatches.filter(m => predSet.has(m.id)).length
  const firstUnpredGroup = allGroupMatches.find(
    m => !predSet.has(m.id) && !isMatchLocked(m.kickoff_at)
  )

  // Finals tab badge
  const finalsMatchCount = allKnockoutMatches.length
  const finalsPredCount  = allKnockoutMatches.filter(m => predSet.has(m.id)).length
  const firstKnockoutKickoff = allKnockoutMatches[0]?.kickoff_at   // first R32 match
  const firstUnpredFinal = allKnockoutMatches.find(
    m => !predSet.has(m.id) && !isMatchLocked(m.kickoff_at)
  )

  // Tournament tab badge
  const fp = finalistCountRes.data
  const finalistDone  = [fp?.first_team_id, fp?.second_team_id, fp?.third_team_id].filter(Boolean).length
  const scorerDone    = Math.min(scorerCountRes.data?.length ?? 0, 5)
  const sp            = secretsCountRes.data
  const secretsDone   = (sp?.favourite_team_id ? 1 : 0) + (sp?.favourite_player_id ? 1 : 0)
  const tournamentDone  = finalistDone + scorerDone + secretsDone
  const tournamentTotal = 10  // 3 finalist + 5 scorers + 1 fav team + 1 fav player
  const tournamentStart = new Date(process.env.NEXT_PUBLIC_TOURNAMENT_START ?? '2026-06-11T16:00:00Z')
  const tournamentStarted = isTournamentStarted()

  // ─────────────────────────────────────────────────────────────────────
  // Tab-specific data
  // ─────────────────────────────────────────────────────────────────────

  // Compute lock-countdown set: all upcoming matches within 7 days (predicted or not)
  // PredictionCard handles the two visual states: solid = no pick, ghost = pick made
  const allScheduledMatches = [...(groupMatchesRes.data ?? []), ...(knockoutMatchesRes.data ?? [])]
    .filter(m => !isMatchLocked(m.kickoff_at))
    .sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime())
  const lockCountdownIds = new Set(allScheduledMatches.map(m => m.id))

  // Group tab
  let groupMatches: Match[] = []
  let predictionMap  = new Map<string, Prediction>()
  let distMap = new Map<string, { home: number; draw: number; away: number; total: number }>()

  if (activeTab === 'matches') {
    const { data: matchData } = await supabase
      .from('matches')
      .select('*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*)')
      .eq('stage', 'group')
      .not('home_team_id', 'is', null)
      .not('away_team_id', 'is', null)
      .order('kickoff_at')

    const matchIds = (matchData ?? []).map(m => m.id)
    const { data: predData }     = await supabase.from('predictions').select('*').eq('user_id', user.id).in('match_id', matchIds)
    const { data: allPredsGroup } = await supabase.from('predictions').select('match_id, predicted_home, predicted_away').in('match_id', matchIds)

    groupMatches  = (matchData ?? []) as Match[]
    predictionMap = new Map((predData ?? []).map(p => [p.match_id, p as Prediction]))
    for (const p of allPredsGroup ?? []) {
      const d = distMap.get(p.match_id) ?? { home: 0, draw: 0, away: 0, total: 0 }
      d.total++
      if (p.predicted_home > p.predicted_away) d.home++
      else if (p.predicted_home < p.predicted_away) d.away++
      else d.draw++
      distMap.set(p.match_id, d)
    }
  }

  // Tournament tab
  let teams = null, players = null, finalistPick = null, scorerPicks = null
  let favTeamId: string | null = null, favPlayerId: string | null = null
  if (activeTab === 'tournament') {
    const [teamsRes, playersRes, finalistRes, scorerRes, profileRes] = await Promise.all([
      supabase.from('teams').select('*').order('name'),
      supabase.from('players').select('*, team:teams(name)').order('name').limit(2000),
      supabase.from('finalist_picks').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('scorer_picks').select('*, player:players(name, position), team:teams(name, flag_url)').eq('user_id', user.id),
      supabase.from('profiles').select('favourite_team_id, favourite_player_id').eq('id', user.id).maybeSingle(),
    ])
    teams = teamsRes.data; players = playersRes.data
    finalistPick = finalistRes.data; scorerPicks = scorerRes.data
    favTeamId   = profileRes.data?.favourite_team_id   ?? null
    favPlayerId = profileRes.data?.favourite_player_id ?? null
  }

  // Finals tab
  let knockoutMatches: Match[] = []
  let knockoutPredMap = new Map<string, Prediction>()
  let knockoutDistMap = new Map<string, { home: number; draw: number; away: number; total: number }>()
  let groupLeaders: GroupLeaders = {}

  if (activeTab === 'finals') {
    const [
      { data: matchData },
      { data: groupMatchData },
      { data: groupTeamData },
    ] = await Promise.all([
      supabase.from('matches').select('*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*)')
        .in('stage', KNOCKOUT_STAGES).order('kickoff_at'),
      supabase.from('matches').select('*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*)')
        .eq('stage', 'group').not('home_team_id', 'is', null).not('away_team_id', 'is', null),
      supabase.from('teams').select('*').not('group_letter', 'is', null),
    ])

    const matchIds = (matchData ?? []).map(m => m.id)
    const { data: predData }        = await supabase.from('predictions').select('*').eq('user_id', user.id).in('match_id', matchIds)
    const { data: allPredsKnockout } = await supabase.from('predictions').select('match_id, predicted_home, predicted_away').in('match_id', matchIds)

    knockoutMatches  = (matchData ?? []) as Match[]
    knockoutPredMap  = new Map((predData ?? []).map(p => [p.match_id, p as Prediction]))
    for (const p of allPredsKnockout ?? []) {
      const d = knockoutDistMap.get(p.match_id) ?? { home: 0, draw: 0, away: 0, total: 0 }
      d.total++
      if (p.predicted_home > p.predicted_away) d.home++
      else if (p.predicted_home < p.predicted_away) d.away++
      else d.draw++
      knockoutDistMap.set(p.match_id, d)
    }

    groupLeaders = computeGroupLeaders(
      (groupMatchData ?? []) as Match[],
      (groupTeamData ?? []) as Team[],
    )
  }

  // ─────────────────────────────────────────────────────────────────────
  // Tab bar helper
  // ─────────────────────────────────────────────────────────────────────
  const tabs = [
    {
      key: 'tournament',
      href: '/predictions?tab=tournament',
      label: 'Tournament',
      done: tournamentDone,
      total: tournamentTotal,
      sub: tournamentStarted
        ? 'Picks locked'
        : `by ${format(tournamentStart, 'd MMM')}`,
    },
    {
      key: 'matches',
      href: '/predictions',
      label: 'Group Stage',
      done: groupPredCount,
      total: groupMatchCount,
      sub: groupPredCount === groupMatchCount && groupMatchCount > 0
        ? 'All done! ✓'
        : firstUnpredGroup
        ? `by ${format(new Date(firstUnpredGroup.kickoff_at), 'd MMM')}`
        : '—',
    },
    {
      key: 'finals',
      href: '/predictions?tab=finals',
      label: 'Knockouts',
      done: finalsPredCount,
      total: finalsMatchCount,
      sub: firstUnpredFinal
        ? `by ${format(new Date(firstUnpredFinal.kickoff_at), 'd MMM')}`
        : firstKnockoutKickoff
        ? `from ${format(new Date(firstKnockoutKickoff), 'd MMM')}`
        : '—',
    },
  ]

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
          {lastSynced && (
            <span style={{ color: '#c4bfb8' }}> &middot; Last updated {format(new Date(lastSynced), 'd MMM · HH:mm')}</span>
          )}
        </p>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex mb-8" style={{ borderBottom: '2px solid #141414' }}>
        {tabs.map((t, i) => {
          const isActive = activeTab === t.key
          const allDone  = t.done === t.total && t.total > 0
          return (
            <Link
              key={t.key}
              href={t.href}
              className="flex flex-col flex-1 px-3 py-3 sm:px-5 transition-colors"
              style={{
                background:   isActive ? '#141414' : '#faf9f7',
                borderRight:  i < tabs.length - 1 ? '1px solid #e0dbd3' : 'none',
                textDecoration: 'none',
              }}
            >
              {/* Tab name */}
              <span
                className="text-xs font-bold uppercase tracking-wider mb-1.5 block"
                style={{
                  color: isActive ? '#ffffff' : '#141414',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {t.label}
              </span>

              {/* Count badge */}
              <span
                className="text-base font-bold block leading-none mb-1"
                style={{
                  color: allDone ? '#22c55e' : '#ff5c35',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {t.done}<span style={{ color: isActive ? '#6b6b6b' : '#c4bfb8', fontWeight: 400, fontSize: '12px' }}>/{t.total}</span>
              </span>

              {/* Deadline / status */}
              <span
                className="text-xs block"
                style={{
                  color: isActive ? '#9ca3af' : '#6b6b6b',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {t.sub}
              </span>
            </Link>
          )
        })}
      </div>

      {/* ── Group Predictions tab ── */}
      {activeTab === 'matches' && (
        <>
          {groupMatches.length > 0 ? (
            <GroupMatchesList
              matches={groupMatches}
              predictionMap={Object.fromEntries(predictionMap)}
              distMap={Object.fromEntries(distMap)}
              userId={user.id}
              lockCountdownIds={lockCountdownIds}
              fanCountMap={fanCountMap}
            />
          ) : (
            <div className="text-center py-16 text-sm" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
              Group fixtures haven&apos;t been loaded yet. Check back soon!
            </div>
          )}
        </>
      )}

      {/* ── Tournament Predictions tab ── */}
      {activeTab === 'tournament' && (
        <TournamentPicksClient
          userId={user.id}
          teams={teams ?? []}
          players={players ?? []}
          finalistPick={finalistPick ?? null}
          scorerPicks={scorerPicks ?? []}
          favTeamId={favTeamId}
          favPlayerId={favPlayerId}
          locked={tournamentStarted}
        />
      )}

      {/* ── Final Predictions tab ── */}
      {activeTab === 'finals' && (
        <>
          {/* Informational banner — shown until the knockout stage kicks off */}
          {firstKnockoutKickoff && !isMatchLocked(firstKnockoutKickoff) && (
            <div
              className="px-4 py-3 mb-8 text-xs uppercase tracking-wider leading-relaxed"
              style={{
                border: '1px solid #e0dbd3',
                background: '#faf9f7',
                color: '#6b6b6b',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              You can fill these out when the knockout stage starts on{' '}
              <span className="font-semibold" style={{ color: '#141414' }}>
                {format(new Date(firstKnockoutKickoff), 'EEEE d MMMM yyyy')}
              </span>.
              Predictions lock match by match at each kick-off.
            </div>
          )}

          {/* Knockout matches grouped by round */}
          {KNOCKOUT_STAGES.map(stage => {
            const stageMatches = knockoutMatches.filter(m => m.stage === stage)
            if (!stageMatches.length) return null
            return (
              <section key={stage} className="mb-8">
                <h2
                  className="text-lg mb-3 pb-2"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, color: '#141414', borderBottom: '1px solid #e0dbd3' }}
                >
                  {stageName(stage)}
                </h2>
                {stage === 'round_of_32' && (
                  <p className="mb-3 text-xs" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
                    <span style={{ color: '#141414', fontWeight: 600 }}>Bold name</span>
                    {' = confirmed qualifier · '}
                    <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Italic name</span>
                    {' = current leader (group still in play)'}
                  </p>
                )}
                <div style={{ border: '1px solid #e0dbd3' }}>
                  {stageMatches.map(match => {
                    let homeSlotInfo: SlotInfo | undefined
                    let awaySlotInfo: SlotInfo | undefined
                    if (stage === 'round_of_32' && match.match_number != null) {
                      const slots = R32_SLOT_MAP[match.match_number]
                      if (slots) {
                        homeSlotInfo = resolveSlot(slots[0], groupLeaders)
                        awaySlotInfo = resolveSlot(slots[1], groupLeaders)
                      }
                    }
                    return (
                      <PredictionCard
                        key={match.id}
                        match={match}
                        prediction={knockoutPredMap.get(match.id) ?? null}
                        userId={user.id}
                        distribution={knockoutDistMap.get(match.id)}
                        showLockCountdown={lockCountdownIds.has(match.id)}
                        homeSlotInfo={homeSlotInfo}
                        awaySlotInfo={awaySlotInfo}
                      />
                    )
                  })}
                </div>
              </section>
            )
          })}

          {knockoutMatches.length === 0 && (
            <div className="text-center py-16 text-sm" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
              Knockout fixtures will appear here once the group stage is complete.
            </div>
          )}
        </>
      )}
    </div>
  )
}
