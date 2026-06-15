import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMatchCentreData } from '@/lib/matchCentre'
import MatchCentre from '@/components/home/MatchCentre'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ matchId: string }>
}

const sans = 'Inter, sans-serif'

export default async function MatchCentrePage({ params }: Props) {
  const { matchId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'
  const data = await getMatchCentreData(isAdmin, matchId)

  if (!data) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-12">
        <Link
          href="/"
          className="text-sm hover:opacity-70 transition-opacity mb-6 inline-block"
          style={{ color: '#6b6b6b', fontFamily: sans }}
        >
          ← Back
        </Link>
        <p className="text-sm" style={{ color: '#6b6b6b', fontFamily: sans }}>
          Match details not available.
        </p>
      </main>
    )
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <Link
        href="/"
        className="text-sm hover:opacity-70 transition-opacity mb-6 inline-block"
        style={{ color: '#6b6b6b', fontFamily: sans }}
      >
        ← Back
      </Link>
      <MatchCentre data={data} currentUserId={user.id} />
    </main>
  )
}
