'use client'

import { useState } from 'react'
import PredictionCard from './PredictionCard'
import type { Match, Prediction } from '@/types'

const sans = 'Inter, sans-serif'
const serif = "'Playfair Display', Georgia, serif"

interface Props {
  matches: Match[]
  predictionMap: Record<string, Prediction | null>
  distMap: Record<string, { home: number; draw: number; away: number; total: number }>
  userId: string
  lockCountdownIds?: Set<string>
}

export default function GroupMatchesList({ matches, predictionMap, distMap, userId, lockCountdownIds }: Props) {
  const [sort, setSort] = useState<'group' | 'date'>('group')

  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: '5px 14px',
    fontSize: '0.7rem',
    fontWeight: 600,
    fontFamily: sans,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    border: 'none',
    cursor: 'pointer',
    background: active ? '#141414' : 'transparent',
    color: active ? '#ffffff' : '#6b6b6b',
    transition: 'all 0.15s',
  })

  if (sort === 'date') {
    // Chronological — one flat list ordered by kickoff_at
    const sorted = [...matches].sort(
      (a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime()
    )

    return (
      <>
        <SortBar sort={sort} setSort={setSort} btnStyle={btnStyle} />
        <div style={{ border: '1px solid #e0dbd3' }}>
          {sorted.map(match => (
            <PredictionCard
              key={match.id}
              match={match}
              prediction={predictionMap[match.id] ?? null}
              userId={userId}
              distribution={distMap[match.id]}
              showLockCountdown={lockCountdownIds?.has(match.id)}
            />
          ))}
        </div>
      </>
    )
  }

  // Group view — grouped by group_letter, alphabetical
  const byGroup = new Map<string, Match[]>()
  for (const m of matches) {
    const g = m.group_letter ?? '?'
    if (!byGroup.has(g)) byGroup.set(g, [])
    byGroup.get(g)!.push(m)
  }
  const groups = Array.from(byGroup.entries()).sort(([a], [b]) => a.localeCompare(b))

  return (
    <>
      <SortBar sort={sort} setSort={setSort} btnStyle={btnStyle} />
      {groups.map(([group, gMatches]) => (
        <section key={group} className="mb-8">
          <h2
            className="text-lg mb-3 pb-2 flex items-center gap-2"
            style={{ fontFamily: serif, fontWeight: 700, color: '#141414', borderBottom: '1px solid #e0dbd3' }}
          >
            <span
              className="w-6 h-6 flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background: '#141414', fontFamily: sans }}
            >
              {group}
            </span>
            Group {group}
          </h2>
          <div style={{ border: '1px solid #e0dbd3' }}>
            {gMatches.map(match => (
              <PredictionCard
                key={match.id}
                match={match}
                prediction={predictionMap[match.id] ?? null}
                userId={userId}
                distribution={distMap[match.id]}
                showLockCountdown={lockCountdownIds?.has(match.id)}
              />
            ))}
          </div>
        </section>
      ))}
    </>
  )
}

function SortBar({
  sort, setSort, btnStyle,
}: {
  sort: 'group' | 'date'
  setSort: (s: 'group' | 'date') => void
  btnStyle: (active: boolean) => React.CSSProperties
}) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: '#6b6b6b', fontFamily: 'Inter, sans-serif' }}>
        Sort by:
      </span>
      <div style={{ display: 'flex', border: '1px solid #e0dbd3', background: '#faf9f6' }}>
        <button style={btnStyle(sort === 'group')} onClick={() => setSort('group')}>Group</button>
        <button style={{ ...btnStyle(sort === 'date'), borderLeft: '1px solid #e0dbd3' }} onClick={() => setSort('date')}>Date</button>
      </div>
    </div>
  )
}
