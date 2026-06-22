import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { BADGE_MAP } from '@/lib/badges/definitions'
import { format } from 'date-fns'

export const revalidate = 300

const serif = "'Playfair Display', Georgia, serif"
const sans  = 'Inter, sans-serif'

const RARITY_COLOR: Record<string, string> = { common: '#6b6b6b', uncommon: '#16a34a', rare: '#2563eb', very_rare: '#9333ea' }
const RARITY_BG:    Record<string, string> = { common: '#f3f4f6', uncommon: '#dcfce7', rare: '#dbeafe', very_rare: '#f3e8ff' }

export default async function BadgePage({ params }: { params: Promise<{ badgeId: string }> }) {
  const { badgeId } = await params
  const badge = BADGE_MAP[badgeId]
  if (!badge) notFound()

  const supabase = await createClient()

  const { data: raw } = await supabase
    .from('user_badges')
    .select('user_id, earned_at, profile:profiles(id, display_name, total_points, favourite_team:teams(name, flag_url))')
    .eq('badge_id', badgeId)
    .order('earned_at', { ascending: true })

  const earners = (raw ?? []).map((e: any) => ({
    userId:      e.user_id as string,
    earnedAt:    e.earned_at as string,
    displayName: e.profile?.display_name ?? 'Unknown',
    totalPoints: e.profile?.total_points ?? 0,
    flag:        e.profile?.favourite_team?.flag_url ?? null,
    teamName:    e.profile?.favourite_team?.name ?? null,
  }))

  const rarityColor = RARITY_COLOR[badge.rarity] ?? '#6b6b6b'
  const rarityBg    = RARITY_BG[badge.rarity]    ?? '#f3f4f6'

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">

      {/* Back */}
      <Link
        href="/stats"
        className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider mb-6 transition-opacity hover:opacity-70"
        style={{ color: '#6b6b6b', fontFamily: sans, textDecoration: 'none' }}
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to stats
      </Link>

      {/* Badge header */}
      <div className="p-6 mb-6" style={{ border: '1px solid #e0dbd3', background: '#ffffff' }}>
        <div className="flex items-start gap-5">
          <span className="text-5xl flex-shrink-0">{badge.emoji}</span>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h1 className="text-3xl" style={{ fontFamily: serif, fontWeight: 900, color: '#141414' }}>
                {badge.name}
              </h1>
              <span
                className="text-xs font-semibold px-2 py-1"
                style={{ background: rarityBg, color: rarityColor, fontFamily: sans }}
              >
                {badge.rarity.replace('_', ' ')}
              </span>
            </div>
            <p className="text-sm mb-3" style={{ color: '#6b6b6b', fontFamily: sans }}>{badge.desc}</p>
            <p className="text-sm font-bold" style={{ color: '#ff5c35', fontFamily: sans }}>
              {earners.length} {earners.length === 1 ? 'Looper has' : 'Loopers have'} earned this
            </p>
          </div>
        </div>
      </div>

      {/* Earners list */}
      {earners.length === 0 ? (
        <div className="p-10 text-center" style={{ border: '1px solid #e0dbd3', background: '#faf9f6' }}>
          <p className="text-2xl mb-2">🔒</p>
          <p className="text-sm" style={{ color: '#6b6b6b', fontFamily: sans }}>No Looper has earned this badge yet.</p>
        </div>
      ) : (
        <div style={{ border: '1px solid #e0dbd3' }}>
          <div
            className="px-4 py-3 text-xs font-semibold uppercase tracking-wider"
            style={{ background: '#141414', color: '#ffffff', fontFamily: sans }}
          >
            {earners.length} {earners.length === 1 ? 'Looper' : 'Loopers'}
          </div>
          {earners.map((earner, i) => (
            <Link
              key={earner.userId}
              href={`/profile/${earner.userId}`}
              className="flex items-center gap-3 px-4 hover:opacity-80 transition-opacity"
              style={{
                minHeight: 56,
                background: i % 2 === 0 ? '#ffffff' : '#faf9f6',
                borderBottom: i < earners.length - 1 ? '1px solid #e0dbd3' : 'none',
                textDecoration: 'none',
              }}
            >
              <span
                className="w-5 text-xs font-bold text-center flex-shrink-0"
                style={{ color: '#9ca3af', fontFamily: sans }}
              >
                {i + 1}
              </span>
              {earner.flag && (
                <img src={earner.flag} alt="" className="w-6 h-4 object-contain flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold block truncate" style={{ color: '#141414', fontFamily: sans }}>
                  {earner.displayName}
                </span>
                {earner.teamName && (
                  <span className="text-xs" style={{ color: '#9ca3af', fontFamily: sans }}>{earner.teamName}</span>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <span className="text-xs block" style={{ color: '#9ca3af', fontFamily: sans }}>
                  {format(new Date(earner.earnedAt), 'd MMM')}
                </span>
                <span className="text-xs font-semibold block" style={{ color: '#ff5c35', fontFamily: sans }}>
                  {earner.totalPoints} pts
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

    </div>
  )
}
