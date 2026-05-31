'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Trophy, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Team, Player } from '@/types'

const schema = z.object({
  display_name:       z.string().min(2, 'Name must be at least 2 characters'),
  email:              z.string().email().endsWith('@loopearplugs.com', 'Must be a @loopearplugs.com email'),
  password:           z.string().min(8, 'Password must be at least 8 characters'),
  favourite_team_id:  z.string().min(1, 'Please pick your favourite team'),
  favourite_player_id: z.string().min(1, 'Please pick your favourite player'),
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f0e8] px-4 py-12">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#ff5c35] mb-4">
            <Trophy className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Join the competition</h1>
          <p className="text-gray-500 mt-1 text-sm">Loop employees only · @loopearplugs.com</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Your name</label>
              <input {...register('display_name')} placeholder="e.g. Maarten V."
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5c35]" />
              {errors.display_name && <p className="text-red-500 text-xs mt-1">{errors.display_name.message}</p>}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Work email</label>
              <input {...register('email')} type="email" placeholder="you@loopearplugs.com"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5c35]" />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <input {...register('password')} type="password" placeholder="Min. 8 characters"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5c35]" />
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>

            {/* Divider */}
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs text-gray-500 mb-4">
                🏆 Pick your favourite team and player — this personalises your profile on the leaderboard.
              </p>

              {/* Favourite team */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Favourite team</label>
                <select {...register('favourite_team_id')}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5c35] bg-white">
                  <option value="">Select a team…</option>
                  {teams.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                {errors.favourite_team_id && <p className="text-red-500 text-xs mt-1">{errors.favourite_team_id.message}</p>}
              </div>

              {/* Favourite player */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Favourite player</label>
                <select {...register('favourite_player_id')}
                  disabled={!selectedTeamId || loadingPlayers}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5c35] bg-white disabled:opacity-50">
                  <option value="">{loadingPlayers ? 'Loading squad…' : 'Select a player…'}</option>
                  {players.map(p => (
                    <option key={p.id} value={p.id}>{p.name}{p.position ? ` · ${p.position}` : ''}</option>
                  ))}
                </select>
                {errors.favourite_player_id && <p className="text-red-500 text-xs mt-1">{errors.favourite_player_id.message}</p>}
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>
            )}

            <button type="submit" disabled={isSubmitting}
              className="w-full bg-[#ff5c35] hover:bg-[#e04a26] text-white font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Create account
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-[#ff5c35] font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
