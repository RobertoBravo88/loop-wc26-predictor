import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { WC2026_SQUADS_TEXT } from '@/data/wc2026-squads'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// ── Position map ─────────────────────────────────────────────────────────────

const POSITION_MAP: Record<string, string> = {
  'Goalkeepers': 'Goalkeeper',
  'Defenders':   'Defender',
  'Midfielders': 'Midfielder',
  'Forwards':    'Forward',
}

// ── The 48 team names exactly as they appear in the squad text ───────────────

const TEAM_NAMES_IN_TEXT = new Set([
  'Mexico', 'South Africa', 'South Korea', 'Czechia',
  'Canada', 'Bosnia-Herzegovina', 'Qatar', 'Switzerland',
  'Brazil', 'Morocco', 'Haiti', 'Scotland',
  'United States', 'Australia', 'Paraguay', 'Türkiye',
  'Germany', 'Curacao', 'Ivory Coast', 'Ecuador',
  'Netherlands', 'Japan', 'Sweden', 'Tunisia',
  'Belgium', 'Egypt', 'Iran', 'New Zealand',
  'Spain', 'Cape Verde', 'Uruguay', 'Saudi Arabia',
  'France', 'Senegal', 'Iraq', 'Norway',
  'Argentina', 'Algeria', 'Austria', 'Jordan',
  'Portugal', 'Congo DR', 'Uzbekistan', 'Colombia',
  'England', 'Croatia', 'Ghana', 'Panama',
])

// ── Corrections map: text name → DB name ────────────────────────────────────

const TEAM_NAME_CORRECTIONS: Record<string, string> = {
  'South Korea':        'Korea Republic',
  'Czechia':            'Czech Republic',
  'Bosnia-Herzegovina': 'Bosnia and Herzegovina',
  'Türkiye':            'Turkey',
  'Curacao':            'Curaçao',
  'Ivory Coast':        "Côte d'Ivoire",
  'Congo DR':           'Congo DR',
  'United States':      'USA',
}

// ── Types ────────────────────────────────────────────────────────────────────

interface ParsedPlayer {
  name: string
  position: string
  club: string
}

interface ParsedTeam {
  textName: string
  manager: string
  players: ParsedPlayer[]
}

// ── Parser helpers ───────────────────────────────────────────────────────────

function parsePlayers(content: string, position: string): ParsedPlayer[] {
  const regex = /([^(,\n]+?)\s*\(([^)]+)\)/g
  const players: ParsedPlayer[] = []
  let match
  while ((match = regex.exec(content)) !== null) {
    const name = match[1].trim().replace(/,\s*$/, '')
    const club = match[2].trim()
    if (name.length > 1 && club.length > 0) {
      players.push({ name, position, club })
    }
  }
  return players
}

function parseSquads(text: string): ParsedTeam[] {
  const teams: ParsedTeam[] = []
  let current: ParsedTeam | null = null

  const skipPatterns = [
    /^GROUP [A-Z]$/,
    /^Final squad/i,
    /^Roster announced/i,
    /^Preliminary/i,
    /^Provisional/i,
  ]

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    if (skipPatterns.some(p => p.test(line))) continue

    const posMatch = line.match(/^(Goalkeepers|Defenders|Midfielders|Forwards):\s*(.+)/)
    if (posMatch && current) {
      const position = POSITION_MAP[posMatch[1]]
      current.players.push(...parsePlayers(posMatch[2], position))
      continue
    }

    const managerMatch = line.match(/^Manager:\s*(.+)/)
    if (managerMatch && current) {
      current.manager = managerMatch[1].trim()
      teams.push(current)
      current = null
      continue
    }

    if (TEAM_NAMES_IN_TEXT.has(line)) {
      current = { textName: line, manager: '', players: [] }
    }
  }

  return teams
}

// ── POST handler ─────────────────────────────────────────────────────────────

export async function POST() {
  const supabase = createServiceClient()

  // ── 1. Auth check — service client, no session needed; just verify env ───
  // (Service key gives full access; this endpoint should be behind admin UI only)

  // ── 2. Parse the embedded squad text ─────────────────────────────────────
  const parsedTeams = parseSquads(WC2026_SQUADS_TEXT)

  // ── 3. Load DB teams for matching ────────────────────────────────────────
  const { data: dbTeams, error: teamsErr } = await supabase
    .from('teams')
    .select('id, name')

  if (teamsErr) {
    return NextResponse.json({ error: `Failed to load teams: ${teamsErr.message}` }, { status: 500 })
  }

  const teamByName = new Map<string, string>() // normalised name → id
  for (const t of dbTeams ?? []) {
    teamByName.set(t.name.toLowerCase().trim(), t.id)
  }

  function findTeamId(textName: string): string | null {
    const corrected = TEAM_NAME_CORRECTIONS[textName] ?? textName
    return (
      teamByName.get(corrected.toLowerCase().trim()) ??
      teamByName.get(textName.toLowerCase().trim()) ??
      null
    )
  }

  // ── 4. Reset DB ───────────────────────────────────────────────────────────

  // Delete all scorer_picks
  const { error: spErr } = await supabase
    .from('scorer_picks')
    .delete()
    .not('id', 'is', null)
  if (spErr) {
    return NextResponse.json({ error: `Failed to clear scorer_picks: ${spErr.message}` }, { status: 500 })
  }

  // Clear favourite_player_id on all profiles
  const { error: profErr } = await supabase
    .from('profiles')
    .update({ favourite_player_id: null })
    .not('id', 'is', null)
  if (profErr) {
    return NextResponse.json({ error: `Failed to clear profiles.favourite_player_id: ${profErr.message}` }, { status: 500 })
  }

  // Clear player_id on goal_events (pre-tournament, may be empty — ignore errors)
  await supabase
    .from('goal_events')
    .update({ player_id: null })
    .not('id', 'is', null)

  // Delete all players
  const { error: delErr } = await supabase
    .from('players')
    .delete()
    .not('id', 'is', null)
  if (delErr) {
    return NextResponse.json({ error: `Failed to delete players: ${delErr.message}` }, { status: 500 })
  }

  // ── 5. Insert players & update managers ──────────────────────────────────

  const unmatchedTeams: string[] = []
  const matchedTeams: string[] = []
  let totalPlayersInserted = 0

  // Collect all players for batch insert
  const allPlayers: Array<{ name: string; position: string; club: string; team_id: string }> = []

  for (const team of parsedTeams) {
    const teamId = findTeamId(team.textName)
    if (!teamId) {
      unmatchedTeams.push(team.textName)
      continue
    }
    matchedTeams.push(team.textName)

    for (const player of team.players) {
      allPlayers.push({
        name:     player.name,
        position: player.position,
        club:     player.club,
        team_id:  teamId,
      })
    }

    // Update manager
    if (team.manager) {
      await supabase
        .from('teams')
        .update({ manager: team.manager })
        .eq('id', teamId)
    }
  }

  // Insert in batches of 100
  const BATCH_SIZE = 100
  for (let i = 0; i < allPlayers.length; i += BATCH_SIZE) {
    const batch = allPlayers.slice(i, i + BATCH_SIZE)
    const { error: insErr } = await supabase.from('players').insert(batch)
    if (insErr) {
      return NextResponse.json(
        { error: `Failed to insert players batch ${i}–${i + batch.length}: ${insErr.message}` },
        { status: 500 }
      )
    }
    totalPlayersInserted += batch.length
  }

  return NextResponse.json({
    success: true,
    teamsMatched: matchedTeams.length,
    teamsParsed:  parsedTeams.length,
    playersInserted: totalPlayersInserted,
    unmatchedTeams,
    matchedTeams,
  })
}
