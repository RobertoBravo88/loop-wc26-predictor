'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Team, Player } from '@/types'

const schema = z.object({
  display_name:       z.string().min(2, 'Name must be at least 2 characters'),
  email:              z.string().email().endsWith('@loopearplugs.com', 'Must be a @loopearplugs.com email'),
  password:           z.string().min(8, 'Password must be at least 8 characters'),
  favourite_team_id:  z.string().min(1, 'Please pick your favourite team'),
  favourite_player_id: z.string().optional(),
})
type Form = z.infer<typeof schema>

export default function SignupPage() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [teams, setTeams] = useState<Team[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [loadingPlayers, setLoadingPlayers] = useState(false)

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  })

  const selectedTeamId = watch('favourite_team_id')

  // Load teams on mount
  useEffect(() => {
    const supabase = createClient()
    supabase.from('teams').select('*').order('name').then(({ data }) => {
      setTeams(data ?? [])
    })
  }, [])

  // Load players when team changes
  useEffect(() => {
    if (!selectedTeamId) { setPlayers([]); return }
    setLoadingPlayers(true)
    setValue('favourite_player_id', '')
    const supabase = createClient()
    supabase
      .from('players')
      .select('*')
      .eq('team_id', selectedTeamId)
      .order('name')
      .then(({ data }) => {
        setPlayers(data ?? [])
        setLoadingPlayers(false)
      })
  }, [selectedTeamId, setValue])

  async function onSubmit(values: Form) {
    setError('')
    const supabase = createClient()

    const { error: signUpError } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: {
          display_name:        values.display_name,
          favourite_team_id:   values.favourite_team_id,
          favourite_player_id: values.favourite_player_id,
        },
      },
    })

    if (signUpError) { setError(signUpError.message); return }

    // Update profile with team/player picks (trigger creates the row)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('profiles').update({
        display_name:        values.display_name,
        favourite_team_id:   values.favourite_team_id,
        favourite_player_id: values.favourite_player_id,
      }).eq('id', user.id)
    }

    router.push('/auth/verify')
  }

  const inputStyle = {
    border: '1px solid #e0dbd3',
    background: '#ffffff',
    color: '#141414',
    fontFamily: 'Inter, sans-serif'
  }

  const labelStyle = {
    color: '#141414',
    fontFamily: 'Inter, sans-serif'
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: '#f7f4ef' }}
    >
      <div className="w-full max-w-md">

        {/* Masthead */}
        <div className="text-center mb-10">
          <h1
            className="text-4xl mb-1"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 900, color: '#141414' }}
          >
            Join the Competition
          </h1>
          <p className="text-xs uppercase tracking-widest" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
            Loop employees only &middot; @loopearplugs.com
          </p>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e0dbd3' }} className="p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

            {/* Name */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={labelStyle}>
                Your name
              </label>
              <input
                {...register('display_name')}
                placeholder="e.g. Maarten V."
                className="w-full px-4 py-2.5 text-sm focus:outline-none"
                style={inputStyle}
              />
              {errors.display_name && (
                <p className="text-xs mt-1" style={{ color: '#dc2626', fontFamily: 'Inter, sans-serif' }}>
                  {errors.display_name.message}
                </p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={labelStyle}>
                Work email
              </label>
              <input
                {...register('email')}
                type="email"
                placeholder="you@loopearplugs.com"
                className="w-full px-4 py-2.5 text-sm focus:outline-none"
                style={inputStyle}
              />
              {errors.email && (
                <p className="text-xs mt-1" style={{ color: '#dc2626', fontFamily: 'Inter, sans-serif' }}>
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={labelStyle}>
                Password
              </label>
              <input
                {...register('password')}
                type="password"
                placeholder="Min. 8 characters"
                className="w-full px-4 py-2.5 text-sm focus:outline-none"
                style={inputStyle}
              />
              {errors.password && (
                <p className="text-xs mt-1" style={{ color: '#dc2626', fontFamily: 'Inter, sans-serif' }}>
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Divider */}
            <div className="pt-4" style={{ borderTop: '1px solid #e0dbd3' }}>
              <p className="text-xs mb-4" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
                Pick your favourite team and player — this personalises your profile on the leaderboard.
              </p>

              {/* Favourite team */}
              <div className="mb-4">
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={labelStyle}>
                  Favourite team
                </label>
                <select
                  {...register('favourite_team_id')}
                  className="w-full px-4 py-2.5 text-sm focus:outline-none"
                  style={inputStyle}
                >
                  <option value="">Select a team…</option>
                  {teams.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                {errors.favourite_team_id && (
                  <p className="text-xs mt-1" style={{ color: '#dc2626', fontFamily: 'Inter, sans-serif' }}>
                    {errors.favourite_team_id.message}
                  </p>
                )}
              </div>

              {/* Favourite player */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={labelStyle}>
                  Favourite player{' '}
                  <span className="font-normal normal-case tracking-normal" style={{ color: '#6b6b6b' }}>
                    (optional)
                  </span>
                </label>
                <select
                  {...register('favourite_player_id')}
                  disabled={!selectedTeamId || loadingPlayers}
                  className="w-full px-4 py-2.5 text-sm focus:outline-none disabled:opacity-50"
                  style={inputStyle}
                >
                  <option value="">{loadingPlayers ? 'Loading squad…' : 'Select a player…'}</option>
                  {players.map(p => (
                    <option key={p.id} value={p.id}>{p.name}{p.position ? ` · ${p.position}` : ''}</option>
                  ))}
                </select>
                {errors.favourite_player_id && (
                  <p className="text-xs mt-1" style={{ color: '#dc2626', fontFamily: 'Inter, sans-serif' }}>
                    {errors.favourite_player_id.message}
                  </p>
                )}
              </div>
            </div>

            {error && (
              <div
                className="text-sm px-4 py-3"
                style={{ background: '#fff5f5', color: '#dc2626', border: '1px solid #fecaca', fontFamily: 'Inter, sans-serif' }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full text-white font-semibold py-2.5 text-sm transition-colors flex items-center justify-center gap-2"
              style={{
                background: isSubmitting ? '#e04a26' : '#ff5c35',
                fontFamily: 'Inter, sans-serif',
                opacity: isSubmitting ? 0.8 : 1
              }}
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Create account
            </button>
          </form>

          <p className="mt-5 text-center text-xs" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
            Already have an account?{' '}
            <Link href="/auth/login" className="font-semibold hover:underline" style={{ color: '#ff5c35' }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
