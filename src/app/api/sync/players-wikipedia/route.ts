import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Imports all 48 WC 2026 squads from Wikipedia.
// Creates players with full names and positions but no api_id.
// Run the admin linker afterwards to connect api_ids for picked players.

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Map Wikipedia display names → DB team names where they differ
const NAME_ALIASES: Record<string, string> = {
  'Bosnia and Herzegovina': 'Bosnia-Herzegovina',
  'IR Iran':                'Iran',
  'Korea Republic':         'South Korea',
}

const POSITION_MAP: Record<string, string> = {
  'GK': 'Goalkeeper',
  'DF': 'Defender',
  'MF': 'Midfielder',
  'FW': 'Forward',
}

// Decode common HTML entities that appear in player names
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g,  '&')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g,  "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .trim()
}

export async function POST() {
  const supabase = createServiceClient()

  try {
    const res = await fetch('https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_squads', {
      headers: { 'User-Agent': 'Mozilla/5.0 Loop-WC26/1.0' },
      next: { revalidate: 0 },
    })
    if (!res.ok) throw new Error(`Wikipedia fetch failed: ${res.status}`)
    const html = await res.text()

    // Load all DB teams for name matching
    const { data: dbTeams } = await supabase.from('teams').select('id, name')
    const teamByName = new Map<string, string>() // lowercase name → id
    for (const t of dbTeams ?? []) teamByName.set(t.name.toLowerCase(), t.id)

    function findTeamId(wikiName: string): string | null {
      const resolved = NAME_ALIASES[wikiName] ?? wikiName
      return teamByName.get(resolved.toLowerCase()) ?? null
    }

    // Split HTML on <h3 id=" — each piece is a team section
    const parts = html.split('<h3 id="')
    let inserted = 0
    let skipped  = 0
    const unmatched: string[] = []
    const teamResults: Array<{ team: string; added: number }> = []

    for (const part of parts.slice(1)) {
      // Extract display name: format is `{id}">Display Name</h3>...`
      const gtIdx = part.indexOf('">')
      if (gtIdx === -1) continue
      const nameEnd = part.indexOf('</h3>', gtIdx + 2)
      if (nameEnd === -1) continue
      const teamName = decodeEntities(part.slice(gtIdx + 2, nameEnd))
      if (!teamName) continue

      const teamId = findTeamId(teamName)
      if (!teamId) {
        unmatched.push(teamName)
        continue
      }

      // Crop section to just this team (stop at next h2/h3)
      const nextHeading = part.search(/<h[23][\s>]/)
      const sectionHtml = nextHeading > -1 ? part.slice(0, nextHeading) : part

      // Extract coach — "Coach: [optional flag HTML] <a ...>Name</a>"
      const coachMatch = sectionHtml.match(/Coach:[\s\S]*?<a[^>]*>([^<]+)<\/a>/)
      const coachName  = coachMatch ? decodeEntities(coachMatch[1]) : null
      if (coachName) {
        await supabase.from('teams').update({ manager: coachName }).eq('id', teamId)
      }

      // Parse each player row
      const rowParts = sectionHtml.split('<tr class="nat-fs-player">')
      let teamInserted = 0

      for (const row of rowParts.slice(1)) {
        // Position abbreviation — e.g. >GK</a>
        const posMatch = row.match(/>(GK|DF|MF|FW)<\/a>/)
        const position = posMatch ? (POSITION_MAP[posMatch[1]] ?? posMatch[1]) : null

        // Player name — first <a> link inside <th scope="row">
        const thMatch = row.match(/<th[^>]*scope="row"[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/)
        if (!thMatch) continue
        const name = decodeEntities(thMatch[1])
        if (!name) continue

        // Skip if exact name already exists for this team
        const { data: existing } = await supabase
          .from('players')
          .select('id')
          .eq('team_id', teamId)
          .eq('name', name)
          .maybeSingle()

        if (existing) {
          skipped++
          continue
        }

        const { error } = await supabase.from('players').insert({ name, team_id: teamId, position })
        if (!error) {
          inserted++
          teamInserted++
        }
      }

      if (teamInserted > 0) teamResults.push({ team: teamName, added: teamInserted })
    }

    return NextResponse.json({
      message: `Imported ${inserted} new players (${skipped} already existed), coaches updated. Unmatched teams: ${unmatched.join(', ') || 'none'}`,
      inserted,
      skipped,
      unmatched,
      byTeam: teamResults,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
