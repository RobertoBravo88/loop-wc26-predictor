import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Imports all 48 WC 2026 squads from Wikipedia.
// Extracts name, position, age, club from each player row.
// If the player already exists, updates their age + club (enrich run).
// Run auto-link afterwards to connect api_ids.

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Map Wikipedia display names → DB team names where they differ
const NAME_ALIASES: Record<string, string> = {
  'Bosnia and Herzegovina': 'Bosnia-Herzegovina',
  'IR Iran':                'Iran',
  'Korea Republic':         'South Korea',
  'United States':          'USA',
}

// Wikipedia section titles that are NOT teams — skip them
const NON_TEAM_SECTIONS = new Set([
  'Age', 'Coach representation by country', 'Notes', 'References',
  'External links', 'Squads', 'Key', 'Legend',
])

const POSITION_MAP: Record<string, string> = {
  'GK': 'Goalkeeper',
  'DF': 'Defender',
  'MF': 'Midfielder',
  'FW': 'Forward',
}

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

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '').trim()
}

// Extract age from "(age XX)" pattern
function parseAge(row: string): number | null {
  const m = row.match(/\(age[^\)]*?(\d{1,2})\)/)
  return m ? parseInt(m[1], 10) : null
}

// Extract club from the last <td> in the row.
// The WC squad table columns are: # | Pos | Player | DOB (age) | Caps | Goals | Club
// Club is the last <td>. It may contain a flag image + club link or plain text.
function parseClub(row: string): string | null {
  // Split on </td> and work backwards to find the last td with a real value
  const segments = row.split('</td>')
  for (let i = segments.length - 2; i >= 0; i--) {
    const seg = segments[i]
    const tdStart = seg.lastIndexOf('<td')
    if (tdStart === -1) continue
    const tdContent = seg.slice(tdStart)
    const text = stripTags(tdContent).replace(/\s+/g, ' ').trim()
    // Skip blank or purely-numeric cells (those are caps / goals)
    if (!text || /^\d+$/.test(text)) continue
    // Skip if it's a position abbreviation
    if (['GK','DF','MF','FW'].includes(text)) continue
    // Prefer the text inside a link if available
    const linkMatch = tdContent.match(/<a[^>]*>([^<]+)<\/a>/)
    return decodeEntities(linkMatch ? linkMatch[1] : text)
  }
  return null
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

    const { data: dbTeams } = await supabase.from('teams').select('id, name')
    const teamByName = new Map<string, string>()
    for (const t of dbTeams ?? []) teamByName.set(t.name.toLowerCase(), t.id)

    function findTeamId(wikiName: string): string | null {
      const resolved = NAME_ALIASES[wikiName] ?? wikiName
      return teamByName.get(resolved.toLowerCase()) ?? null
    }

    const parts = html.split('<h3 id="')
    let inserted = 0
    let enriched = 0
    let skipped  = 0
    const unmatched: string[] = []
    const teamResults: Array<{ team: string; added: number; enriched: number }> = []

    for (const part of parts.slice(1)) {
      const gtIdx = part.indexOf('">')
      if (gtIdx === -1) continue
      const nameEnd = part.indexOf('</h3>', gtIdx + 2)
      if (nameEnd === -1) continue
      const rawInner = part.slice(gtIdx + 2, nameEnd)
      const teamName = decodeEntities(rawInner.replace(/<[^>]+>/g, '')).trim()
      if (!teamName) continue
      if (NON_TEAM_SECTIONS.has(teamName)) continue

      const teamId = findTeamId(teamName)
      if (!teamId) { unmatched.push(teamName); continue }

      const nextHeading = part.search(/<h[23][\s>]/)
      const sectionHtml = nextHeading > -1 ? part.slice(0, nextHeading) : part

      // Coach
      const coachMatch = sectionHtml.match(/Coach:[\s\S]*?<a[^>]*>([^<]+)<\/a>/)
      const coachName  = coachMatch ? decodeEntities(coachMatch[1]) : null
      if (coachName) {
        await supabase.from('teams').update({ manager: coachName }).eq('id', teamId)
      }

      const rowParts = sectionHtml.split('<tr class="nat-fs-player">')
      let teamInserted = 0
      let teamEnriched = 0

      for (const row of rowParts.slice(1)) {
        const posMatch = row.match(/>(GK|DF|MF|FW)<\/a>/)
        const position = posMatch ? (POSITION_MAP[posMatch[1]] ?? posMatch[1]) : null

        const thMatch = row.match(/<th[^>]*scope="row"[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/)
        if (!thMatch) continue
        const name = decodeEntities(thMatch[1])
        if (!name) continue

        const age  = parseAge(row)
        const club = parseClub(row)

        // Check if player already exists for this team
        const { data: existing } = await supabase
          .from('players')
          .select('id')
          .eq('team_id', teamId)
          .eq('name', name)
          .maybeSingle()

        if (existing) {
          // Enrich existing player with age + club if we have them
          if (age !== null || club !== null) {
            const patch: Record<string, any> = {}
            if (age  !== null) patch.age  = age
            if (club !== null) patch.club = club
            await supabase.from('players').update(patch).eq('id', existing.id)
            enriched++
            teamEnriched++
          } else {
            skipped++
          }
          continue
        }

        const { error } = await supabase.from('players').insert({
          name, team_id: teamId, position, age, club,
        })
        if (!error) { inserted++; teamInserted++ }
      }

      if (teamInserted > 0 || teamEnriched > 0) {
        teamResults.push({ team: teamName, added: teamInserted, enriched: teamEnriched })
      }
    }

    return NextResponse.json({
      message: `Imported ${inserted} new, enriched ${enriched} existing players. Coaches updated. Unmatched teams: ${unmatched.join(', ') || 'none'}`,
      inserted,
      enriched,
      skipped,
      unmatched,
      byTeam: teamResults,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
