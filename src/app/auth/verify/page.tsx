import Link from 'next/link'
import { Mail } from 'lucide-react'

export default function VerifyPage() {
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
            Almost there
          </p>
        </div>

        {/* Card */}
        <div
          className="text-center p-10 space-y-4"
          style={{ background: '#ffffff', border: '1px solid #e0dbd3' }}
        >
          <div
            className="inline-flex items-center justify-center w-12 h-12 mx-auto"
            style={{ background: '#fff3f0', border: '1px solid #e0dbd3' }}
          >
            <Mail className="w-6 h-6" style={{ color: '#ff5c35' }} />
          </div>

          <h2
            className="text-xl"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, color: '#141414' }}
          >
            Check your email
          </h2>

          <p
            className="text-sm leading-relaxed"
            style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}
          >
            We sent a verification link to your Loop email address.<br />
            Click it to activate your account and start predicting.
          </p>

          <div style={{ borderTop: '1px solid #e0dbd3', paddingTop: '1rem' }}>
            <Link
              href="/auth/login"
              className="text-xs uppercase tracking-wider font-semibold hover:underline"
              style={{ color: '#ff5c35', fontFamily: 'Inter, sans-serif' }}
            >
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
