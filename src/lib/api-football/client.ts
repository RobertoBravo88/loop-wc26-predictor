// ============================================================
// api-football.com client
// ============================================================

const API_BASE = 'https://v3.football.api-sports.io'
const API_KEY = process.env.API_FOOTBALL_KEY ?? ''
const WC_2026_ID = 1 // FIFA World Cup 2026 league/tournament ID — confirm once key is active

function headers() {
  return {
    'x-apisports-key': API_KEY,
    'Content-Type': 'application/json',
  }
}

async function get<T>(endpoint: string, params: Record<string, string | number> = {}): Promise<T> {
  const url = new URL(`${API_BASE}${endpoint}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)))

  const res = await fetch(url.toString(), {
    headers: headers(),
    next: { revalidate: 0 }, // always fresh in cron context
  })

  if (!res.ok) {
    throw new Error(`API Football error: ${res.status} ${await res.text()}`)
  }

  const data = await res.json()
  return data.response as T
}

// ============================================================
// Teams & squads
// ============================================================

export async function fetchTeams(season: number = 2026) {
  return get<any[]>('/teams', { league: WC_2026_ID, season })
}

export async function fetchSquad(teamApiId: number, season: number = 2026) {
  const data = await get<any[]>('/players/squads', { team: teamApiId, league: WC_2026_ID, season })
  // Fall back to team-only query if the league/season filter returns nothing
  if (data.length === 0) {
    return get<any[]>('/players/squads', { team: teamApiId })
  }
  return data
}

// ============================================================
// Fixtures
// ============================================================

export async function fetchFixtures(season: number = 2026) {
  return get<any[]>('/fixtures', { league: WC_2026_ID, season })
}

export async function fetchFixtureById(fixtureApiId: number) {
  const data = await get<any[]>('/fixtures', { id: fixtureApiId })
  return data[0] ?? null
}

// ============================================================
// Live / finished match result
// ============================================================

export async function fetchMatchResult(fixtureApiId: number) {
  const data = await get<any[]>('/fixtures', {
    id: fixtureApiId,
    timezone: 'Europe/Brussels',
  })

  const fixture = data[0]
  if (!fixture) return null

  return {
    status: fixture.fixture.status.short,        // 'FT', 'NS', 'LIVE', etc.
    homeScore: fixture.goals.home as number | null,
    awayScore: fixture.goals.away as number | null,
    events: fixture.events as any[],
  }
}

// ============================================================
// Standings (group tables)
// ============================================================

export async function fetchStandings(season: number = 2026) {
  return get<any[]>('/standings', { league: WC_2026_ID, season })
}

// ============================================================
// Map API status → our MatchStatus
// ============================================================

export function mapStatus(apiStatus: string): 'scheduled' | 'in_play' | 'finished' | 'postponed' | 'cancelled' {
  if (['FT', 'AET', 'PEN', 'AWD', 'WO'].includes(apiStatus)) return 'finished'
  if (['1H', 'HT', '2H', 'ET', 'BT', 'P', 'INT', 'LIVE'].includes(apiStatus)) return 'in_play'
  if (['CANC'].includes(apiStatus))              return 'cancelled'
  if (['PST', 'ABD', 'SUSP'].includes(apiStatus)) return 'postponed'
  return 'scheduled'
}
