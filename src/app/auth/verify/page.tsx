import Link from 'next/link'
import { Trophy, Mail } from 'lucide-react'

export default function VerifyPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f0e8] px-4">
      <div className="w-full max-w-md text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#ff5c35] mb-6">
          <Trophy className="w-7 h-7 text-white" />
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 space-y-4">
          <Mail className="w-12 h-12 text-[#ff5c35] mx-auto" />
          <h1 className="text-xl font-bold text-gray-900">Verify your email</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            We sent a verification link to your Loop email address.<br />
            Click it to activate your account and start predicting.
          </p>
          <Link href="/auth/login"
            className="inline-block mt-2 text-sm text-[#ff5c35] font-medium hover:underline">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  )
}
