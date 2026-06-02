import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { isTournamentStarted } from '@/lib/utils'
import Link from 'next/link'
import type { Match } from '@/types'

export const revalidate = 60

interface PredRow {
  match_id: string
  predicted_home: number
  predicted_away: number
  is_exact: boolean | null
  is_correct_outcome: boolean | null
  points_total: number
}

function outcomeColor(pred: PredRow | undefined): string {
  if (!pred) return 'transparent'
  if (pred.is_exact) return '#22c55e'
  if (pred.is_correct_outcome) return '#eab308'
  return '#f87171'
}

function FinalistRow({ label, teamA, teamB, correctA, correctB }: {
  label: string
  teamA: { name?: string | null; flag_url?: string | null } | null
  teamB: { name?: string | null; flag_url?: string | null } | null
  correctA: boolean | null
  correctB: boolean | null
}) {
  function cellStyle(correct: boolean | null): React.CSSProperties {
    return {
      background: correct === true ? '#f0fdf4' : correct === false ? '#fff5f5' : '#faf9f6',
      border: `1px solid ${correct === true ? '#86efac' : correct === false ? '#fca5a5' : '#e0dbd3'}`,
      padding: '8px 12px',
      textAlign: 'center',
      fontFamily: 'Inter, sans-serif',
    }
  }
  return (
    <tr>
      <td className="px-3 py-2 text-xs" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif', borderBottom: '1px solid #e0dbd3' }}>{label}</td>
      <td style={{ ...cellStyle(correctA), borderBottom: '1px solid #e0dbd3' }}>
        <div className="flex flex-col items-center gap-1">
          {teamA?.flag_url && <img src={teamA.flag_url} alt="" className="w-6 h-4 object-contain" />}
          <span className="text-xs font-semibold" style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}>{teamA?.name ?? '—'}</span>
        </div>
      </td>
      <td style={{ ...cellStyle(correctB), borderBottom: '1px solid #e0dbd3' }}>
        <div className="flex flex-col items-center gap-1">
          {teamB?.flag_url && <img src={teamB.flag_url} alt="" className="w-6 h-4 object-contain" />}
          <span className="text-xs font-semibold" style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}>{teamB?.name ?? '—'}</span>
        </div>
      </td>
    </tr>
  )
}

export default async function ComparePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId: targetId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const myId = user.id

  // Fetch both profiles
  const [myProfileRes, theirProfileRes] = await Promise.all([
    supabase.from('profiles').select('*, favourite_team:teams(*), favourite_player:players(*)').eq('id', myId).single(),
    supabase.from('profiles').select('*, favourite_team:teams(*), favourite_player:players(*)').eq('id', targetId).single(),
  ])

  const myProfile = myProfileRes.data
  const theirProfile = theirProfileRes.data
  if (!myProfile || !theirProfile) notFound()

  // Fetch leaderboard entries for both
  const [myLbRes, theirLbRes] = await Promise.all([
    supabase.from('leaderboard').select('rank, total_points, matches_predicted, exact_scores, correct_outcomes').eq('id', myId).single(),
    supabase.from('leaderboard').select('rank, total_points, matches_predicted, exact_scores, correct_outcomes').eq('id', targetId).single(),
  ])
  const myLb = myLbRes.data
  const theirLb = theirLbRes.data

  // Fetch all finished matches with teams
  const { data: finishedMatches } = await supabase
    .from('matches')
    .select('*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*)')
    .eq('status', 'finished')
    .order('kickoff_at', { ascending: true })

  const matchIds = (finishedMatches ?? []).map((m: any) => m.id)

  // Fetch predictions for both users on finished matches
  const [myPredsRes, theirPredsRes] = await Promise.all([
    matchIds.length > 0
      ? supabase.from('predictions').select('match_id, predicted_home, predicted_away, is_exact, is_correct_outcome, points_total').eq('user_id', myId).in('match_id', matchIds)
      : { data: [] },
    matchIds.length > 0
      ? supabase.from('predictions').select('match_id, predicted_home, predicted_away, is_exact, is_correct_outcome, points_total').eq('user_id', targetId).in('match_id', matchIds)
      : { data: [] },
  ])

  const myPredMap = new Map<string, PredRow>((myPredsRes.data ?? []).map((p: any) => [p.match_id, p as PredRow]))
  const theirPredMap = new Map<string, PredRow>((theirPredsRes.data ?? []).map((p: any) => [p.match_id, p as PredRow]))

  // Fetch finalist picks
  const [myFinalistRes, theirFinalistRes] = await Promise.all([
    supabase.from('finalist_picks').select('*, first_team:teams!first_team_id(*), second_team:teams!second_team_id(*), third_team:teams!third_team_id(*)').eq('user_id', myId).maybeSingle(),
    supabase.from('finalist_picks').select('*, first_team:teams!first_team_id(*), second_team:teams!second_team_id(*), third_team:teams!third_team_id(*)').eq('user_id', targetId).maybeSingle(),
  ])
  const myFinalist = myFinalistRes.data
  const theirFinalist = theirFinalistRes.data

  // Fetch scorer picks
  const [myScorersRes, theirScorersRes] = await Promise.all([
    supabase.from('scorer_picks').select('*, player:players(name), team:teams(name, flag_url)').eq('user_id', myId),
    supabase.from('scorer_picks').select('*, player:players(name), team:teams(name, flag_url)').eq('user_id', targetId),
  ])
  const myScorers = (myScorersRes.data ?? []) as any[]
  const theirScorers = (theirScorersRes.data ?? []) as any[]

  const tournamentStarted = isTournamentStarted()
  const serif = "'Playfair Display', Georgia, serif"
  const sans = 'Inter, sans-serif'

  function UserHeader({ profile, lb, isLeft }: {
    profile: any
    lb: any
    isLeft: boolean
  }) {
    return (
      <div className="flex flex-col items-center gap-2 p-4" style={{ background: isLeft ? '#141414' : '#ff5c35' }}>
        <div
          className="w-12 h-12 flex items-center justify-center text-2xl font-bold text-white"
          style={{ background: 'rgba(255,255,255,0.15)', fontFamily: serif }}
        >
          {profile.display_name.charAt(0).toUpperCase()}
        </div>
        <div className="text-center">
          <div className="text-sm font-bold text-white" style={{ fontFamily: sans }}>{profile.display_name}</div>
          {(tournamentStarted) && profile.favourite_team?.flag_url && (
            <img src={profile.favourite_team.flag_url} alt="" className="w-6 h-4 object-contain mx-auto mt-1" />
          )}
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-white" style={{ fontFamily: serif }}>{lb?.total_points ?? 0}</div>
          <div className="text-xs text-white/70" style={{ fontFamily: sans }}>pts · #{lb?.rank ?? '—'}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">

      {/* Header */}
      <div className="mb-6 pb-3" style={{ borderBottom: '2px solid #141414' }}>
        <Link href="/leaderboard" className="text-xs uppercase tracking-wider hover:opacity-70 transition-opacity mb-2 inline-block" style={{ color: '#ff5c35', fontFamily: sans }}>
          ← Leaderboard
        </Link>
        <h1
          className="text-3xl"
          style={{ fontFamily: serif, fontWeight: 900, color: '#141414' }}
        >
          Head-to-Head
        </h1>
      </div>

      {/* User headers */}
      <div className="grid grid-cols-2 gap-2">
        <UserHeader profile={myProfile} lb={myLb} isLeft={true} />
        <UserHeader profile={theirProfile} lb={theirLb} isLeft={false} />
      </div>

      {/* Stats summary */}
      <div style={{ border: '1px solid #e0dbd3', background: '#ffffff' }}>
        <div className="px-4 py-2" style={{ borderBottom: '1px solid #e0dbd3', background: '#faf9f6' }}>
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b6b6b', fontFamily: sans }}>Stats</span>
        </div>
        {[
          { label: 'Predictions made', a: myLb?.matches_predicted ?? 0, b: theirLb?.matches_predicted ?? 0 },
          { label: 'Exact scores',      a: myLb?.exact_scores ?? 0,      b: theirLb?.exact_scores ?? 0      },
          { label: 'Correct outcomes',  a: myLb?.correct_outcomes ?? 0,  b: theirLb?.correct_outcomes ?? 0  },
          { label: 'Current streak',    a: myProfile.current_streak ?? 0, b: theirProfile.current_streak ?? 0 },
        ].map(row => {
          const aWins = row.a > row.b
          const bWins = row.b > row.a
          return (
            <div
              key={row.label}
              className="grid grid-cols-3 items-center px-4 py-3"
              style={{ borderBottom: '1px solid #e0dbd3' }}
            >
              <span
                className="text-sm font-bold text-center"
                style={{ color: aWins ? '#141414' : '#9ca3af', fontFamily: sans }}
              >
                {row.a}
              </span>
              <span className="text-xs text-center" style={{ color: '#6b6b6b', fontFamily: sans }}>{row.label}</span>
              <span
                className="text-sm font-bold text-center"
                style={{ color: bWins ? '#ff5c35' : '#9ca3af', fontFamily: sans }}
              >
                {row.b}
              </span>
            </div>
          )
        })}
      </div>

      {/* Match-by-match */}
      {finishedMatches && finishedMatches.length > 0 && (
        <div style={{ border: '1px solid #e0dbd3', background: '#ffffff' }}>
          <div className="px-4 py-2" style={{ borderBottom: '1px solid #e0dbd3', background: '#faf9f6' }}>
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b6b6b', fontFamily: sans }}>Match by Match</span>
          </div>
          {(finishedMatches as Match[]).map(match => {
            const myPred = myPredMap.get(match.id)
            const theirPred = theirPredMap.get(match.id)
            return (
              <div
                key={match.id}
                className="px-4 py-3"
                style={{ borderBottom: '1px solid #e0dbd3' }}
              >
                {/* Teams + score */}
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0">
                    {match.home_team?.flag_url && (
                      <img src={match.home_team.flag_url} alt="" className="w-5 h-3.5 object-contain flex-shrink-0" />
                    )}
                    <span className="text-sm font-semibold truncate" style={{ color: '#141414', fontFamily: sans }}>
                      {match.home_team?.name ?? '?'}
                    </span>
                  </div>
                  <span
                    className="text-xs font-bold px-2 py-1 flex-shrink-0"
                    style={{ background: '#141414', color: '#ffffff', fontFamily: sans }}
                  >
                    {match.home_score} – {match.away_score}
                  </span>
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <span className="text-sm font-semibold truncate" style={{ color: '#141414', fontFamily: sans }}>
                      {match.away_team?.name ?? '?'}
                    </span>
                    {match.away_team?.flag_url && (
                      <img src={match.away_team.flag_url} alt="" className="w-5 h-3.5 object-contain flex-shrink-0" />
                    )}
                  </div>
                </div>

                {/* Predictions side by side */}
                <div className="grid grid-cols-2 gap-2">
                  <div
                    className="text-center text-xs px-2 py-1.5"
                    style={{
                      background: myPred ? '#faf9f6' : '#f7f4ef',
                      borderLeft: `3px solid ${outcomeColor(myPred)}`,
                      fontFamily: sans,
                    }}
                  >
                    {myPred
                      ? <span style={{ color: '#141414' }}>{myPred.predicted_home}–{myPred.predicted_away} <span style={{ color: '#ff5c35', fontWeight: 600 }}>+{myPred.points_total}</span></span>
                      : <span style={{ color: '#c4bfb8' }}>—</span>
                    }
                  </div>
                  <div
                    className="text-center text-xs px-2 py-1.5"
                    style={{
                      background: theirPred ? '#faf9f6' : '#f7f4ef',
                      borderRight: `3px solid ${outcomeColor(theirPred)}`,
                      fontFamily: sans,
                    }}
                  >
                    {theirPred
                      ? <span style={{ color: '#141414' }}>{theirPred.predicted_home}–{theirPred.predicted_away} <span style={{ color: '#ff5c35', fontWeight: 600 }}>+{theirPred.points_total}</span></span>
                      : <span style={{ color: '#c4bfb8' }}>—</span>
                    }
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Tournament picks comparison */}
      {(myFinalist || theirFinalist || myScorers.length > 0 || theirScorers.length > 0) && (
        <div style={{ border: '1px solid #e0dbd3', background: '#ffffff' }}>
          <div className="px-4 py-2" style={{ borderBottom: '1px solid #e0dbd3', background: '#faf9f6' }}>
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b6b6b', fontFamily: sans }}>Tournament Picks</span>
          </div>

          {/* Crystal Ball */}
          {(myFinalist || theirFinalist) && (
            <div className="px-4 pt-4 pb-2">
              <p className="text-xs uppercase tracking-wider font-semibold mb-3" style={{ color: '#6b6b6b', fontFamily: sans }}>🔮 Crystal Ball</p>
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-xs text-left px-3 py-1" style={{ color: '#6b6b6b', fontFamily: sans, width: '80px' }}></th>
                    <th className="text-xs text-center py-1" style={{ color: '#141414', fontFamily: sans, fontWeight: 700 }}>{myProfile.display_name}</th>
                    <th className="text-xs text-center py-1" style={{ color: '#ff5c35', fontFamily: sans, fontWeight: 700 }}>{theirProfile.display_name}</th>
                  </tr>
                </thead>
                <tbody>
                  <FinalistRow
                    label="Winner"
                    teamA={(myFinalist as any)?.first_team ?? null}
                    teamB={(theirFinalist as any)?.first_team ?? null}
                    correctA={(myFinalist as any)?.first_correct ?? null}
                    correctB={(theirFinalist as any)?.first_correct ?? null}
                  />
                  <FinalistRow
                    label="Runner-up"
                    teamA={(myFinalist as any)?.second_team ?? null}
                    teamB={(theirFinalist as any)?.second_team ?? null}
                    correctA={(myFinalist as any)?.second_correct ?? null}
                    correctB={(theirFinalist as any)?.second_correct ?? null}
                  />
                  <FinalistRow
                    label="3rd place"
                    teamA={(myFinalist as any)?.third_team ?? null}
                    teamB={(theirFinalist as any)?.third_team ?? null}
                    correctA={(myFinalist as any)?.third_correct ?? null}
                    correctB={(theirFinalist as any)?.third_correct ?? null}
                  />
                </tbody>
              </table>
            </div>
          )}

          {/* Golden Boots */}
          {(myScorers.length > 0 || theirScorers.length > 0) && tournamentStarted && (
            <div className="px-4 pt-3 pb-4">
              <p className="text-xs uppercase tracking-wider font-semibold mb-3" style={{ color: '#6b6b6b', fontFamily: sans }}>👟 Golden Boots</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  {myScorers.map((p: any) => (
                    <div key={p.id} className="flex items-center gap-2 mb-1.5">
                      {p.team?.flag_url && <img src={p.team.flag_url} alt="" className="w-4 h-3 object-contain flex-shrink-0" />}
                      <span className="text-xs truncate" style={{ color: '#141414', fontFamily: sans }}>{p.player?.name ?? '—'}</span>
                      {(p.goals_counted ?? 0) > 0 && (
                        <span className="text-xs font-bold flex-shrink-0" style={{ color: '#ff5c35', fontFamily: sans }}>⚽{p.goals_counted}</span>
                      )}
                    </div>
                  ))}
                  {myScorers.length === 0 && <span className="text-xs" style={{ color: '#c4bfb8', fontFamily: sans }}>—</span>}
                </div>
                <div>
                  {theirScorers.map((p: any) => (
                    <div key={p.id} className="flex items-center gap-2 mb-1.5">
                      {p.team?.flag_url && <img src={p.team.flag_url} alt="" className="w-4 h-3 object-contain flex-shrink-0" />}
                      <span className="text-xs truncate" style={{ color: '#141414', fontFamily: sans }}>{p.player?.name ?? '—'}</span>
                      {(p.goals_counted ?? 0) > 0 && (
                        <span className="text-xs font-bold flex-shrink-0" style={{ color: '#ff5c35', fontFamily: sans }}>⚽{p.goals_counted}</span>
                      )}
                    </div>
                  ))}
                  {theirScorers.length === 0 && <span className="text-xs" style={{ color: '#c4bfb8', fontFamily: sans }}>—</span>}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
