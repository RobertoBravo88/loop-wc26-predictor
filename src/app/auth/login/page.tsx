'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const schema = z.object({
  email:    z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
})
type Form = z.infer<typeof schema>

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') ?? '/'
  const [error, setError]                   = useState('')
  const [showCreatePrompt, setShowCreatePrompt] = useState(false)
  const [failedEmail, setFailedEmail]           = useState('')

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(values: Form) {
    setError('')
    setShowCreatePrompt(false)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword(values)
    if (error) {
      const isInvalidCreds = error.message.toLowerCase().includes('invalid login credentials')
        || error.message.toLowerCase().includes('invalid credentials')
        || error.message.toLowerCase().includes('user not found')
      if (isInvalidCreds) {
        setFailedEmail(values.email)
        setShowCreatePrompt(true)
        setError('')
      } else {
        setError(error.message)
      }
      return
    }
    router.push(redirectTo)
    router.refresh()
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: '#f7f4ef' }}
    >
      <div className="w-full max-w-md">

        {/* Masthead */}
        <div className="text-center mb-10">
          <h1
            className="text-4xl mb-1"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 900, color: '#141414' }}
          >
            Loop WC26
          </h1>
          <p className="text-xs uppercase tracking-widest" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
            The squad is waiting.
          </p>
        </div>

        {/* Form card */}
        <div style={{ background: '#ffffff', border: '1px solid #e0dbd3' }} className="p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-wider mb-2"
                style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}
              >
                Email
              </label>
              <input
                {...register('email')}
                type="email"
                autoComplete="email"
                placeholder="you@loopearplugs.com"
                className="w-full px-4 py-2.5 text-sm focus:outline-none"
                style={{
                  border: '1px solid #e0dbd3',
                  background: '#ffffff',
                  color: '#141414',
                  fontFamily: 'Inter, sans-serif'
                }}
              />
              {errors.email && (
                <p className="text-xs mt-1" style={{ color: '#dc2626', fontFamily: 'Inter, sans-serif' }}>
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-wider mb-2"
                style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}
              >
                Password
              </label>
              <input
                {...register('password')}
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full px-4 py-2.5 text-sm focus:outline-none"
                style={{
                  border: '1px solid #e0dbd3',
                  background: '#ffffff',
                  color: '#141414',
                  fontFamily: 'Inter, sans-serif'
                }}
              />
              {errors.password && (
                <p className="text-xs mt-1" style={{ color: '#dc2626', fontFamily: 'Inter, sans-serif' }}>
                  {errors.password.message}
                </p>
              )}
            </div>

            {showCreatePrompt && (
              <div style={{ background: '#fff8f0', border: '1px solid #ff5c35', padding: '1rem', fontFamily: 'Inter, sans-serif' }}>
                <p className="text-sm font-semibold mb-1" style={{ color: '#141414' }}>
                  No account found for this email.
                </p>
                <p className="text-xs mb-3" style={{ color: '#6b6b6b' }}>
                  Want to join the Loop WC26 Predictor? Create your account in 2 minutes.
                </p>
                <div className="flex gap-2">
                  <Link
                    href={`/auth/signup?email=${encodeURIComponent(failedEmail)}`}
                    className="flex-1 text-center text-xs font-semibold py-2 text-white transition-colors"
                    style={{ background: '#ff5c35', fontFamily: 'Inter, sans-serif' }}
                  >
                    Create account →
                  </Link>
                  <button
                    type="button"
                    onClick={() => setShowCreatePrompt(false)}
                    className="text-xs py-2 px-3"
                    style={{ border: '1px solid #e0dbd3', color: '#6b6b6b', fontFamily: 'Inter, sans-serif', background: '#ffffff' }}
                  >
                    Try again
                  </button>
                </div>
              </div>
            )}

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
              className="w-full text-white font-semibold py-2.5 transition-colors flex items-center justify-center gap-2 text-sm"
              style={{
                background: isSubmitting ? '#e04a26' : '#ff5c35',
                fontFamily: 'Inter, sans-serif',
                opacity: isSubmitting ? 0.8 : 1
              }}
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Sign in
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between text-xs" style={{ fontFamily: 'Inter, sans-serif' }}>
            <Link href="/auth/reset" className="hover:underline" style={{ color: '#6b6b6b' }}>
              Forgot password?
            </Link>
            <Link href="/auth/signup" className="font-semibold hover:underline" style={{ color: '#ff5c35' }}>
              Create account
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
