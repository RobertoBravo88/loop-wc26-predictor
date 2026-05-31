'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Team, Player } from '@/types'

// ─── Style constants ──────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  border: '1px solid #e0dbd3',
  background: '#ffffff',
  color: '#141414',
  fontFamily: 'Inter, sans-serif',
  width: '100%',
  padding: '0.625rem 1rem',
  fontSize: '0.875rem',
  outline: 'none',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: '0.5rem',
  color: '#141414',
  fontFamily: 'Inter, sans-serif',
}

const errorStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  marginTop: '0.25rem',
  color: '#dc2626',
  fontFamily: 'Inter, sans-serif',
}

const coralBtn: React.CSSProperties = {
  background: '#ff5c35',
  color: '#ffffff',
  fontFamily: 'Inter, sans-serif',
  fontWeight: 600,
  fontSize: '0.875rem',
  padding: '0.625rem 1.5rem',
  border: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
}

const ghostBtn: React.CSSProperties = {
  background: 'transparent',
  color: '#141414',
  fontFamily: 'Inter, sans-serif',
  fontWeight: 600,
  fontSize: '0.875rem',
  padding: '0.625rem 1.5rem',
  border: '1px solid #e0dbd3',
  cursor: 'pointer',
}

// ─── Form state type ──────────────────────────────────────────────────────────

interface FormData {
  // Step 1
  display_name: string
  email: string
  password: string
  // Step 2
  favourite_team_id: string
  favourite_player_id: string
  // Step 3
  first_team_id: string
  second_team_id: string
  third_team_id: string
  // Step 4
  scorer_picks: Record<string, string> // team_id -> player_id
}

const initialForm: FormData = {
  display_name: '',
  email: '',
  password: '',
  favourite_team_id: '',
  favourite_player_id: '',
  first_team_id: '',
  second_team_id: '',
  third_team_id: '',
  scorer_picks: {},
}

// ─── Step progress indicator ──────────────────────────────────────────────────

function StepIndicator({ step }: { step: number }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
      <p
        style={{
          fontSize: '0.7rem',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: '#6b6b6b',
          fontFamily: 'Inter, sans-serif',
          marginBottom: '0.75rem',
        }}
      >
        Step {step} of 4
      </p>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            style={{
              width: s === step ? '1.5rem' : '0.5rem',
              height: '0.5rem',
              borderRadius: '9999px',
              background: s < step ? '#141414' : s === step ? '#ff5c35' : '#e0dbd3',
              transition: 'all 0.2s',
            }}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SignupPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState<FormData>(initialForm)
  const [globalError, setGlobalError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Shared teams list loaded once
  const [teams, setTeams] = useState<Team[]>([])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('teams')
      .select('*')
      .order('name')
      .then(({ data }) => setTeams(data ?? []))
  }, [])

  function update(patch: Partial<FormData>) {
    setFormData((prev) => ({ ...prev, ...patch }))
  }

  // Final submit
  async function handleSubmit() {
    setIsSubmitting(true)
    setGlobalError('')
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: formData.display_name,
          email: formData.email,
          password: formData.password,
          favourite_team_id: formData.favourite_team_id,
          favourite_player_id: formData.favourite_player_id,
          first_team_id: formData.first_team_id,
          second_team_id: formData.second_team_id,
          third_team_id: formData.third_team_id,
          scorer_picks: formData.scorer_picks,
        }),
      })
      const result = await response.json()
      if (!response.ok) {
        setGlobalError(result.error ?? 'Something went wrong. Please try again.')
        return
      }
      router.push('/auth/verify')
    } catch {
      setGlobalError('Network error. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: '#f7f4ef' }}
    >
      <div className="w-full max-w-lg">

        {/* Masthead */}
        <div className="text-center mb-8">
          <h1
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontWeight: 900,
              color: '#141414',
              fontSize: '2.25rem',
              lineHeight: 1.1,
              marginBottom: '0.375rem',
            }}
          >
            Join the Competition
          </h1>
          <p
            style={{
              fontSize: '0.7rem',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: '#6b6b6b',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            Loop employees only &middot; @loopearplugs.com
          </p>
        </div>

        {/* Card */}
        <div style={{ background: '#ffffff', border: '1px solid #e0dbd3', padding: '2rem' }}>
          <StepIndicator step={step} />

          {step === 1 && (
            <Step1
              formData={formData}
              update={update}
              onNext={() => setStep(2)}
            />
          )}
          {step === 2 && (
            <Step2
              formData={formData}
              teams={teams}
              update={update}
              onNext={() => setStep(3)}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && (
            <Step3
              formData={formData}
              teams={teams}
              update={update}
              onNext={() => setStep(4)}
              onBack={() => setStep(2)}
            />
          )}
          {step === 4 && (
            <Step4
              formData={formData}
              teams={teams}
              update={update}
              onBack={() => setStep(3)}
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
              globalError={globalError}
            />
          )}
        </div>

        <p
          className="mt-5 text-center"
          style={{ fontSize: '0.75rem', color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}
        >
          Already have an account?{' '}
          <Link
            href="/auth/login"
            className="font-semibold hover:underline"
            style={{ color: '#ff5c35' }}
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}

// ─── Step 1: Account details ──────────────────────────────────────────────────

function Step1({
  formData,
  update,
  onNext,
}: {
  formData: FormData
  update: (p: Partial<FormData>) => void
  onNext: () => void
}) {
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate() {
    const e: Record<string, string> = {}
    const trimmed = formData.display_name.trim()
    if (!trimmed || trimmed.split(/\s+/).length < 2) {
      e.display_name = 'Please enter your first and last name'
    }
    if (!formData.email.endsWith('@loopearplugs.com')) {
      e.email = 'Must be a @loopearplugs.com email'
    }
    if (!formData.email.includes('@') || formData.email.length < 6) {
      e.email = 'Please enter a valid email address'
    }
    if (formData.password.length < 8) {
      e.password = 'Password must be at least 8 characters'
    }
    return e
  }

  function handleNext() {
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length === 0) onNext()
  }

  return (
    <div>
      <h2
        style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontWeight: 700,
          fontSize: '1.25rem',
          color: '#141414',
          marginBottom: '1.25rem',
        }}
      >
        Your account details
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Full name */}
        <div>
          <label style={labelStyle}>Your name</label>
          <input
            style={inputStyle}
            value={formData.display_name}
            onChange={(e) => update({ display_name: e.target.value })}
            placeholder="e.g. Maarten Verstraeten"
          />
          {errors.display_name && <p style={errorStyle}>{errors.display_name}</p>}
        </div>

        {/* Email */}
        <div>
          <label style={labelStyle}>Work email</label>
          <input
            style={inputStyle}
            type="email"
            value={formData.email}
            onChange={(e) => update({ email: e.target.value })}
            placeholder="you@loopearplugs.com"
          />
          {errors.email && <p style={errorStyle}>{errors.email}</p>}
        </div>

        {/* Password */}
        <div>
          <label style={labelStyle}>Password</label>
          <input
            style={inputStyle}
            type="password"
            value={formData.password}
            onChange={(e) => update({ password: e.target.value })}
            placeholder="Min. 8 characters"
          />
          {errors.password && <p style={errorStyle}>{errors.password}</p>}
        </div>
      </div>

      <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
        <button style={coralBtn} onClick={handleNext}>
          Continue →
        </button>
      </div>
    </div>
  )
}

// ─── Step 2: Favourites ───────────────────────────────────────────────────────

function Step2({
  formData,
  teams,
  update,
  onNext,
  onBack,
}: {
  formData: FormData
  teams: Team[]
  update: (p: Partial<FormData>) => void
  onNext: () => void
  onBack: () => void
}) {
  const [players, setPlayers] = useState<Player[]>([])
  const [loadingPlayers, setLoadingPlayers] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!formData.favourite_team_id) {
      setPlayers([])
      return
    }
    setLoadingPlayers(true)
    const supabase = createClient()
    supabase
      .from('players')
      .select('*')
      .eq('team_id', formData.favourite_team_id)
      .order('name')
      .then(({ data }) => {
        setPlayers(data ?? [])
        setLoadingPlayers(false)
      })
  }, [formData.favourite_team_id])

  function handleTeamChange(teamId: string) {
    update({ favourite_team_id: teamId, favourite_player_id: '' })
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!formData.favourite_team_id) {
      e.favourite_team_id = 'Please pick your favourite team'
    }
    return e
  }

  function handleNext() {
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length === 0) onNext()
  }

  const noPlayers = !loadingPlayers && formData.favourite_team_id && players.length === 0

  return (
    <div>
      <h2
        style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontWeight: 700,
          fontSize: '1.25rem',
          color: '#141414',
          marginBottom: '0.375rem',
        }}
      >
        Your favourites
      </h2>
      <p
        style={{
          fontSize: '0.8rem',
          color: '#6b6b6b',
          fontFamily: 'Inter, sans-serif',
          marginBottom: '1.25rem',
        }}
      >
        Pick your favourite team and player — this personalises your profile on the leaderboard.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Favourite team */}
        <div>
          <label style={labelStyle}>Favourite team</label>
          <select
            style={inputStyle}
            value={formData.favourite_team_id}
            onChange={(e) => handleTeamChange(e.target.value)}
          >
            <option value="">Select a team…</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.flag_url ? '' : ''}{t.name}
              </option>
            ))}
          </select>
          {errors.favourite_team_id && (
            <p style={errorStyle}>{errors.favourite_team_id}</p>
          )}
        </div>

        {/* Favourite player */}
        <div>
          <label style={labelStyle}>
            Favourite player{' '}
            <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: '#6b6b6b' }}>
              (optional)
            </span>
          </label>

          {noPlayers ? (
            <p
              style={{
                fontSize: '0.8rem',
                color: '#6b6b6b',
                fontFamily: 'Inter, sans-serif',
                fontStyle: 'italic',
                padding: '0.625rem 0',
              }}
            >
              Squads coming soon
            </p>
          ) : (
            <select
              style={{ ...inputStyle, opacity: !formData.favourite_team_id || loadingPlayers ? 0.5 : 1 }}
              disabled={!formData.favourite_team_id || loadingPlayers}
              value={formData.favourite_player_id}
              onChange={(e) => update({ favourite_player_id: e.target.value })}
            >
              <option value="">
                {loadingPlayers ? 'Loading squad…' : 'Select a player…'}
              </option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.position ? ` · ${p.position}` : ''}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between' }}>
        <button style={ghostBtn} onClick={onBack}>
          ← Back
        </button>
        <button style={coralBtn} onClick={handleNext}>
          Continue →
        </button>
      </div>
    </div>
  )
}

// ─── Step 3: Finalist picks ───────────────────────────────────────────────────

function Step3({
  formData,
  teams,
  update,
  onNext,
  onBack,
}: {
  formData: FormData
  teams: Team[]
  update: (p: Partial<FormData>) => void
  onNext: () => void
  onBack: () => void
}) {
  const picks = [
    {
      key: 'first_team_id' as keyof FormData,
      label: '🥇 Winner',
      points: '+300 pts',
    },
    {
      key: 'second_team_id' as keyof FormData,
      label: '🥈 Runner-up',
      points: '+200 pts',
    },
    {
      key: 'third_team_id' as keyof FormData,
      label: '🥉 3rd place',
      points: '+100 pts',
    },
  ]

  return (
    <div>
      <h2
        style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontWeight: 700,
          fontSize: '1.25rem',
          color: '#141414',
          marginBottom: '0.375rem',
        }}
      >
        Who will win the World Cup?
      </h2>
      <p
        style={{
          fontSize: '0.8rem',
          color: '#6b6b6b',
          fontFamily: 'Inter, sans-serif',
          marginBottom: '1.25rem',
        }}
      >
        Lock in your finalist predictions before the tournament starts. All picks are optional.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {picks.map(({ key, label, points }) => (
          <div key={key}>
            <label style={labelStyle}>
              {label}{' '}
              <span
                style={{
                  fontWeight: 400,
                  textTransform: 'none',
                  letterSpacing: 0,
                  color: '#ff5c35',
                }}
              >
                {points}
              </span>
            </label>
            <select
              style={inputStyle}
              value={(formData[key] as string) ?? ''}
              onChange={(e) => update({ [key]: e.target.value } as Partial<FormData>)}
            >
              <option value="">Select a team…</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between' }}>
        <button style={ghostBtn} onClick={onBack}>
          ← Back
        </button>
        <button style={coralBtn} onClick={onNext}>
          Continue →
        </button>
      </div>
    </div>
  )
}

// ─── Step 4: Top scorer per team ─────────────────────────────────────────────

function Step4({
  formData,
  teams,
  update,
  onBack,
  onSubmit,
  isSubmitting,
  globalError,
}: {
  formData: FormData
  teams: Team[]
  update: (p: Partial<FormData>) => void
  onBack: () => void
  onSubmit: () => void
  isSubmitting: boolean
  globalError: string
}) {
  // Load all players keyed by team_id
  const [playersByTeam, setPlayersByTeam] = useState<Record<string, Player[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('players')
      .select('*')
      .order('name')
      .then(({ data }) => {
        const map: Record<string, Player[]> = {}
        for (const p of data ?? []) {
          if (!map[p.team_id]) map[p.team_id] = []
          map[p.team_id].push(p)
        }
        setPlayersByTeam(map)
        setLoading(false)
      })
  }, [])

  function setScorerPick(teamId: string, playerId: string) {
    const next = { ...formData.scorer_picks }
    if (playerId) {
      next[teamId] = playerId
    } else {
      delete next[teamId]
    }
    update({ scorer_picks: next })
  }

  return (
    <div>
      <h2
        style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontWeight: 700,
          fontSize: '1.25rem',
          color: '#141414',
          marginBottom: '0.25rem',
        }}
      >
        Pick your top scorer
      </h2>
      <p
        style={{
          fontSize: '0.8rem',
          color: '#6b6b6b',
          fontFamily: 'Inter, sans-serif',
          marginBottom: '1.25rem',
        }}
      >
        Pick one player per team. Earn +10 pts every time they score. All picks are optional.
      </p>

      {loading ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: '#6b6b6b',
            fontFamily: 'Inter, sans-serif',
            fontSize: '0.875rem',
            padding: '1rem 0',
          }}
        >
          <Loader2 style={{ width: '1rem', height: '1rem', animation: 'spin 1s linear infinite' }} />
          Loading squads…
        </div>
      ) : (
        <div
          style={{
            maxHeight: '380px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            paddingRight: '0.25rem',
          }}
        >
          {teams.map((team) => {
            const teamPlayers = playersByTeam[team.id] ?? []
            const hasPlayers = teamPlayers.length > 0
            const selectedPlayer = formData.scorer_picks[team.id] ?? ''

            return (
              <div
                key={team.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  alignItems: 'center',
                  gap: '0.75rem',
                  paddingBottom: '0.75rem',
                  borderBottom: '1px solid #f0ece6',
                }}
              >
                {/* Team name + flag */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {team.flag_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={team.flag_url}
                      alt=""
                      style={{ width: '1.25rem', height: 'auto', flexShrink: 0 }}
                    />
                  )}
                  <span
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: '#141414',
                    }}
                  >
                    {team.name}
                  </span>
                </div>

                {/* Player dropdown */}
                {hasPlayers ? (
                  <select
                    style={{ ...inputStyle, fontSize: '0.75rem', padding: '0.375rem 0.75rem' }}
                    value={selectedPlayer}
                    onChange={(e) => setScorerPick(team.id, e.target.value)}
                  >
                    <option value="">Select player…</option>
                    {teamPlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}{p.position ? ` · ${p.position}` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    disabled
                    style={{
                      ...inputStyle,
                      fontSize: '0.75rem',
                      padding: '0.375rem 0.75rem',
                      opacity: 0.45,
                      cursor: 'not-allowed',
                    }}
                  >
                    <option>Squad not loaded yet</option>
                  </select>
                )}
              </div>
            )
          })}
        </div>
      )}

      {globalError && (
        <div
          style={{
            marginTop: '1rem',
            padding: '0.75rem 1rem',
            background: '#fff5f5',
            color: '#dc2626',
            border: '1px solid #fecaca',
            fontFamily: 'Inter, sans-serif',
            fontSize: '0.875rem',
          }}
        >
          {globalError}
        </div>
      )}

      <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between' }}>
        <button style={ghostBtn} onClick={onBack} disabled={isSubmitting}>
          ← Back
        </button>
        <button
          style={{ ...coralBtn, opacity: isSubmitting ? 0.75 : 1 }}
          onClick={onSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting && (
            <Loader2 style={{ width: '1rem', height: '1rem', animation: 'spin 1s linear infinite' }} />
          )}
          Create account
        </button>
      </div>
    </div>
  )
}
