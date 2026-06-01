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

// Low-level GET — returns data.response and exposes raw paging info
async function getRaw(endpoint: string, params: Record<string, string | number> = {}): Promise<{ response: any[]; paging: { current: number; total: number } }> {
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
  return {
    response: data.response as any[],
    paging: data.paging ?? { current: 1, total: 1 },
  }
}

async function get<T>(endpoint: string, params: Record<string, string | number> = {}): Promise<T> {
  const { response } = await getRaw(endpoint, params)
  return response as T
}

// (C2) Paginate through all pages using paging.current < paging.total
async function getAll<T>(endpoint: string, params: Record<string, string | number> = {}): Promise<T[]> {
  const results: T[] = []
  let page = 1

  while (true) {
    const { response, paging } = await getRaw(endpoint, { ...params, page })
    results.push(...(response as T[]))
    if (paging.current >= paging.total) break
    page++
  }

  return results
}

// ============================================================
// Teams & squads
// ============================================================

export async function fetchTeams(season: number = 2026) {
  return get<any[]>('/teams', { league: WC_2026_ID, season })
}

export async function fetchSquad(teamApiId: number) {
  return get<any[]>('/players/squads', { team: teamApiId })
}

// Fetch players who actually appeared in WC 2026 fixtures — accurate from June 11 onwards
export async function fetchWCPlayers(teamApiId: number, season: number = 2026, page: number = 1) {
  return get<any[]>('/players', { team: teamApiId, league: WC_2026_ID, season, page })
}

// (N6) Page-aware version: returns players + hasMore flag based on real paging data
export async function fetchWCPlayersPage(
  teamApiId: number,
  season: number = 2026,
  page: number = 1
): Promise<{ players: any[]; hasMore: boolean }> {
  const { response, paging } = await getRaw('/players', {
    team: teamApiId,
    league: WC_2026_ID,
    season,
    page,
  })
  return {
    players: response,
    hasMore: paging.current < paging.total,
  }
}

// ============================================================
// Fixtures
// ============================================================

// (C2) Uses getAll to paginate automatically
// (M8) Throws a descriptive error if no fixtures are returned
export async function fetchFixtures(season: number = 2026) {
  const fixtures = await getAll<any>('/fixtures', { league: WC_2026_ID, season })
  if (!fixtures.length) {
    throw new Error(
      `fetchFixtures returned 0 results for season ${season}. ` +
      `WC_2026_ID (currently ${WC_2026_ID}) may be incorrect — confirm the league ID once the API key is active.`
    )
  }
  return fixtures
}

export async function fetchFixtureById(fixtureApiId: number) {
  const data = await get<any[]>('/fixtures', { id: fixtureApiId })
  return data[0] ?? null
}

// ============================================================
// Live / finished match result
// ============================================================

// (N4 / Auto Crystal Ball) Also returns penalty scores for final matches
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
    penaltyHome: fixture.score?.penalty?.home as number | null ?? null,
    penaltyAway: fixture.score?.penalty?.away as number | null ?? null,
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
