'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Check, KeyRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const schema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm: z.string(),
  })
  .refine(data => data.password === data.confirm, {
    message: "Passwords don't match",
    path: ['confirm'],
  })

type Form = z.infer<typeof schema>

export default function ChangePasswordForm() {
  const [success, setSuccess] = useState(false)
  const [serverError, setServerError] = useState('')

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) })

  async function onSubmit(values: Form) {
    setServerError('')
    setSuccess(false)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: values.password })
    if (error) {
      setServerError(error.message)
      return
    }
    setSuccess(true)
    reset()
  }

  return (
    <div style={{ background: '#ffffff', border: '1px solid #e0dbd3' }} className="p-5">
      <h2
        className="text-lg mb-4 pb-2 flex items-center gap-2"
        style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontWeight: 700,
          color: '#141414',
          borderBottom: '1px solid #e0dbd3',
        }}
      >
        <KeyRound className="w-4 h-4" style={{ color: '#6b6b6b' }} />
        Change Password
      </h2>

      {success ? (
        <div
          className="flex items-center gap-2 px-4 py-3 text-sm"
          style={{
            background: '#f0fdf4',
            border: '1px solid #86efac',
            color: '#15803d',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          <Check className="w-4 h-4 flex-shrink-0" />
          Password updated successfully.
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label
              className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}
            >
              New password
            </label>
            <input
              {...register('password')}
              type="password"
              autoComplete="new-password"
              placeholder="Min. 8 characters"
              className="w-full px-4 py-2.5 text-sm focus:outline-none"
              style={{
                border: '1px solid #e0dbd3',
                background: '#ffffff',
                color: '#141414',
                fontFamily: 'Inter, sans-serif',
              }}
            />
            {errors.password && (
              <p className="text-xs mt-1" style={{ color: '#dc2626', fontFamily: 'Inter, sans-serif' }}>
                {errors.password.message}
              </p>
            )}
          </div>

          <div>
            <label
              className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: '#141414', fontFamily: 'Inter, sans-serif' }}
            >
              Confirm new password
            </label>
            <input
              {...register('confirm')}
              type="password"
              autoComplete="new-password"
              placeholder="Repeat password"
              className="w-full px-4 py-2.5 text-sm focus:outline-none"
              style={{
                border: '1px solid #e0dbd3',
                background: '#ffffff',
                color: '#141414',
                fontFamily: 'Inter, sans-serif',
              }}
            />
            {errors.confirm && (
              <p className="text-xs mt-1" style={{ color: '#dc2626', fontFamily: 'Inter, sans-serif' }}>
                {errors.confirm.message}
              </p>
            )}
          </div>

          {serverError && (
            <div
              className="px-4 py-3 text-sm"
              style={{
                background: '#fff5f5',
                border: '1px solid #fecaca',
                color: '#dc2626',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {serverError}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full text-white font-semibold py-2.5 text-sm flex items-center justify-center gap-2 transition-opacity"
            style={{
              background: '#ff5c35',
              fontFamily: 'Inter, sans-serif',
              opacity: isSubmitting ? 0.7 : 1,
            }}
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Update password
          </button>
        </form>
      )}
    </div>
  )
}
