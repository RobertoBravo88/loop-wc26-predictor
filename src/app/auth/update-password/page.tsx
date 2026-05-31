'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const schema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm:  z.string(),
}).refine(d => d.password === d.confirm, {
  message: 'Passwords do not match',
  path: ['confirm'],
})
type Form = z.infer<typeof schema>

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

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [done, setDone] = useState(false)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  })

  async function onSubmit({ password }: Form) {
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      alert(error.message)
      return
    }
    setDone(true)
    setTimeout(() => router.push('/auth/login'), 2500)
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
            Set a new password
          </p>
        </div>

        {/* Card */}
        <div style={{ background: '#ffffff', border: '1px solid #e0dbd3' }} className="p-8">
          {done ? (
            <div className="text-center space-y-4">
              <div
                className="inline-flex items-center justify-center w-10 h-10 mx-auto"
                style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}
              >
                <Check className="w-5 h-5" style={{ color: '#16a34a' }} />
              </div>
              <p
                className="font-semibold"
                style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}
              >
                Password updated!
              </p>
              <p
                className="text-sm"
                style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}
              >
                Redirecting you to login…
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label
                  className="block text-xs font-semibold uppercase tracking-wider mb-2"
                  style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}
                >
                  New password
                </label>
                <input
                  {...register('password')}
                  type="password"
                  placeholder="At least 8 characters"
                  style={inputStyle}
                />
                {errors.password && (
                  <p className="text-xs mt-1" style={{ color: '#dc2626', fontFamily: 'Inter, sans-serif' }}>
                    {errors.password.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  className="block text-xs font-semibold uppercase tracking-wider mb-2"
                  style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}
                >
                  Confirm password
                </label>
                <input
                  {...register('confirm')}
                  type="password"
                  placeholder="Repeat your new password"
                  style={inputStyle}
                />
                {errors.confirm && (
                  <p className="text-xs mt-1" style={{ color: '#dc2626', fontFamily: 'Inter, sans-serif' }}>
                    {errors.confirm.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full text-white font-semibold py-2.5 transition-colors flex items-center justify-center gap-2 text-sm"
                style={{
                  background: isSubmitting ? '#e04a26' : '#ff5c35',
                  fontFamily: 'Inter, sans-serif',
                  opacity: isSubmitting ? 0.8 : 1,
                }}
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Update password
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
