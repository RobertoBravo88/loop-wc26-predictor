import { NextRequest, NextResponse } from 'next/server'
import { processMatchResult } from '@/lib/points/engine'

export const dynamic    = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const matchId = searchParams.get('matchId')

  if (!matchId) {
    return NextResponse.json({ error: 'matchId query param required' }, { status: 400 })
  }

  try {
    const result = await processMatchResult(matchId)
    return NextResponse.json({
      message: `Processed match ${matchId} — ${result.processed} predictions awarded`,
      ...result,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
