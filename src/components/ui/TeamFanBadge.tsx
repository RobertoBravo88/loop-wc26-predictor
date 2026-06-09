import Link from 'next/link'
import { Shield } from 'lucide-react'

interface Props {
  teamId: string
  count: number
}

export default function TeamFanBadge({ teamId, count }: Props) {
  if (count === 0) return null
  return (
    <Link
      href={`/teams/${teamId}#fans`}
      title={`${count} fan${count === 1 ? '' : 's'} — click to see`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '2px',
        background: '#f0ede8',
        color: '#6b6b6b',
        padding: '1px 5px',
        fontSize: '0.6rem',
        fontFamily: 'Inter, sans-serif',
        fontWeight: 600,
        textDecoration: 'none',
        flexShrink: 0,
        whiteSpace: 'nowrap',
      }}
    >
      <Shield size={9} style={{ color: '#ff5c35', flexShrink: 0 }} />
      {count}
    </Link>
  )
}
