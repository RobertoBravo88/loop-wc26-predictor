'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
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
  const searchParams = useSearchParams()
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState<FormData>({
    ...initialForm,
    email: searchParams.get('email') ?? '',
  })
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
            Join the Loop.
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
    if (!formData.email.includes('@') || formData.email.length < 6) {
      e.email = 'Please enter a valid email address'
    } else if (!formData.email.endsWith('@loopearplugs.com')) {
      e.email = 'Must be a @loopearplugs.com email'
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
          marginBottom: '0.375rem',
        }}
      >
        Your account details
      </h2>
      <p style={{ fontSize: '0.8rem', color: '#6b6b6b', fontFamily: 'Inter, sans-serif', marginBottom: '1rem' }}>
        4 quick steps — account, 12th Man pick, Crystal Ball, Golden Boots. Takes about 2 minutes.
      </p>

      {/* Quick points overview */}
      <div style={{ background: '#faf9f6', border: '1px solid #e0dbd3', padding: '0.75rem 1rem', marginBottom: '1.25rem' }}>
        <p style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#141414', fontFamily: 'Inter, sans-serif', marginBottom: '0.5rem' }}>
          How you earn points
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {[
            { label: 'Predict exact match score',      pts: '100 pts' },
            { label: 'Predict correct outcome',        pts:  '50 pts' },
            { label: '⭐ Favourite team / player goal', pts: '+10 / +20 pts' },
            { label: '🔮 Crystal Ball correct pick',   pts: 'up to 300 pts' },
            { label: '👟 Golden Boots goal',           pts:  '+10 pts' },
          ].map(({ label, pts }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontFamily: 'Inter, sans-serif' }}>
              <span style={{ color: '#6b6b6b' }}>{label}</span>
              <span style={{ color: '#ff5c35', fontWeight: 700 }}>{pts}</span>
            </div>
          ))}
        </div>
      </div>

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
        Your colours 🏴
      </h2>
      <p style={{ fontSize: '0.8rem', color: '#6b6b6b', fontFamily: 'Inter, sans-serif', marginBottom: '1rem' }}>
        Pick the team you actually support. Their flag appears next to your name on the leaderboard.
      </p>

      {/* Points callout */}
      <div style={{ background: '#fff8f0', border: '1px solid #ff5c35', padding: '0.75rem 1rem', marginBottom: '1.25rem' }}>
        <p style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#141414', fontFamily: 'Inter, sans-serif', marginBottom: '0.5rem' }}>
          ⭐ 12th Man — how you earn points
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontFamily: 'Inter, sans-serif' }}>
            <span style={{ color: '#6b6b6b' }}>Every time your favourite team scores</span>
            <span style={{ color: '#ff5c35', fontWeight: 700 }}>+10 pts</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontFamily: 'Inter, sans-serif' }}>
            <span style={{ color: '#6b6b6b' }}>Every time your favourite player scores</span>
            <span style={{ color: '#ff5c35', fontWeight: 700 }}>+20 pts</span>
          </div>
        </div>
      </div>

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
            Your player{' '}
            <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: '#6b6b6b' }}>
              — from your team (optional)
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
        🔮 Crystal Ball
      </h2>
      <p style={{ fontSize: '0.8rem', color: '#6b6b6b', fontFamily: 'Inter, sans-serif', marginBottom: '1rem' }}>
        Who goes all the way? Lock in your picks before the tournament starts — you can&apos;t change them once it kicks off.
      </p>

      {/* Points callout */}
      <div style={{ background: '#fff8f0', border: '1px solid #ff5c35', padding: '0.75rem 1rem', marginBottom: '1.25rem' }}>
        <p style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#141414', fontFamily: 'Inter, sans-serif', marginBottom: '0.5rem' }}>
          🔮 Crystal Ball — how you earn points
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {[
            { label: 'Correct winner', pts: '+300 pts' },
            { label: 'Correct runner-up', pts: '+200 pts' },
            { label: 'Correct 3rd place', pts: '+100 pts' },
          ].map(({ label, pts }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontFamily: 'Inter, sans-serif' }}>
              <span style={{ color: '#6b6b6b' }}>{label}</span>
              <span style={{ color: '#ff5c35', fontWeight: 700 }}>{pts}</span>
            </div>
          ))}
        </div>
      </div>

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

// ─── Step 4: Golden Boots — up to 5 picks ────────────────────────────────────

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
  const [playersByTeam, setPlayersByTeam] = useState<Record<string, Player[]>>({})
  const [loading, setLoading] = useState(true)
  const [addingTeam, setAddingTeam]     = useState('')
  const [addingPlayer, setAddingPlayer] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.from('players').select('*').order('name').then(({ data }) => {
      const map: Record<string, Player[]> = {}
      for (const p of data ?? []) {
        if (!map[p.team_id]) map[p.team_id] = []
        map[p.team_id].push(p)
      }
      setPlayersByTeam(map)
      setLoading(false)
    })
  }, [])

  // picks as array for display
  const picks = Object.entries(formData.scorer_picks).map(([teamId, playerId]) => ({ teamId, playerId }))
  const pickedTeamIds = new Set(picks.map(p => p.teamId))
  // exclude favourite player from golden boots (mutual exclusion)
  const addingTeamPlayers = (playersByTeam[addingTeam] ?? []).filter(p => p.id !== formData.favourite_player_id)
  const availableTeams = teams.filter(t => !pickedTeamIds.has(t.id))

  function addPick() {
    if (!addingTeam || !addingPlayer || picks.length >= 5) return
    const next = { ...formData.scorer_picks, [addingTeam]: addingPlayer }
    update({ scorer_picks: next })
    setAddingTeam('')
    setAddingPlayer('')
  }

  function removePick(teamId: string) {
    const next = { ...formData.scorer_picks }
    delete next[teamId]
    update({ scorer_picks: next })
  }

  const teamById = Object.fromEntries(teams.map(t => [t.id, t]))
  const playerById: Record<string, Player> = {}
  for (const players of Object.values(playersByTeam)) {
    for (const p of players) playerById[p.id] = p
  }

  return (
    <div>
      <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, fontSize: '1.25rem', color: '#141414', marginBottom: '0.375rem' }}>
        👟 Golden Boots
      </h2>
      <p style={{ fontSize: '0.8rem', color: '#6b6b6b', fontFamily: 'Inter, sans-serif', marginBottom: '1rem' }}>
        Pick up to 5 players — one per country. Points stack up every time they score. All picks are optional and can be changed until the tournament starts.
      </p>

      {/* Points callout */}
      <div style={{ background: '#fff8f0', border: '1px solid #ff5c35', padding: '0.75rem 1rem', marginBottom: '1.25rem' }}>
        <p style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#141414', fontFamily: 'Inter, sans-serif', marginBottom: '0.5rem' }}>
          👟 Golden Boots — how you earn points
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontFamily: 'Inter, sans-serif' }}>
          <span style={{ color: '#6b6b6b' }}>Every time one of your 5 players scores a goal</span>
          <span style={{ color: '#ff5c35', fontWeight: 700 }}>+10 pts</span>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#6b6b6b', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', padding: '1rem 0' }}>
          <Loader2 style={{ width: '1rem', height: '1rem', animation: 'spin 1s linear infinite' }} />
          Loading squads…
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

          {/* Current picks */}
          {picks.map((pick, idx) => {
            const team   = teamById[pick.teamId]
            const player = playerById[pick.playerId]
            return (
              <div key={pick.teamId} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0.875rem', background: '#faf9f6', border: '1px solid #e0dbd3' }}>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.7rem', color: '#9ca3af', fontWeight: 700, width: '1rem', textAlign: 'center' }}>{idx + 1}</span>
                {team?.flag_url && <img src={team.flag_url} alt="" style={{ width: '1.25rem', height: 'auto', flexShrink: 0 }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', fontWeight: 600, color: '#141414', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {player?.name ?? '—'}
                  </div>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.7rem', color: '#6b6b6b' }}>{team?.name}</div>
                </div>
                <button
                  onClick={() => removePick(pick.teamId)}
                  style={{ background: 'none', border: '1px solid #e0dbd3', cursor: 'pointer', color: '#6b6b6b', padding: '0.25rem 0.5rem', fontSize: '0.7rem', fontFamily: 'Inter, sans-serif', flexShrink: 0 }}
                >
                  ✕
                </button>
              </div>
            )
          })}

          {/* Add pick row */}
          {picks.length < 5 && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <select
                style={{ ...inputStyle, flex: 1, minWidth: '140px', fontSize: '0.8rem', padding: '0.5rem 0.75rem' }}
                value={addingTeam}
                onChange={e => { setAddingTeam(e.target.value); setAddingPlayer('') }}
              >
                <option value="">Select country…</option>
                {availableTeams.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>

              {addingTeam && (
                <select
                  style={{ ...inputStyle, flex: 1, minWidth: '140px', fontSize: '0.8rem', padding: '0.5rem 0.75rem' }}
                  value={addingPlayer}
                  onChange={e => setAddingPlayer(e.target.value)}
                >
                  <option value="">Select player…</option>
                  {addingTeamPlayers.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}

              {addingTeam && addingPlayer && (
                <button onClick={addPick} style={{ ...coralBtn, padding: '0.5rem 1rem', fontSize: '0.8rem', flexShrink: 0 }}>
                  Add
                </button>
              )}
            </div>
          )}

          {/* Pick counter */}
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: picks.length === 5 ? '#ff5c35' : '#9ca3af' }}>
            {picks.length} / 5 picks
          </p>
        </div>
      )}

      {globalError && (
        <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: '#fff5f5', color: '#dc2626', border: '1px solid #fecaca', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem' }}>
          {globalError}
        </div>
      )}

      <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between' }}>
        <button style={ghostBtn} onClick={onBack} disabled={isSubmitting}>← Back</button>
        <button style={{ ...coralBtn, opacity: isSubmitting ? 0.75 : 1 }} onClick={onSubmit} disabled={isSubmitting}>
          {isSubmitting && <Loader2 style={{ width: '1rem', height: '1rem', animation: 'spin 1s linear infinite' }} />}
          Create account
        </button>
      </div>
    </div>
  )
}
