import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Imports all 48 WC 2026 squads from Wikipedia.
// Extracts name, position, age, club from each player row.
// If the player already exists, updates their age + club (enrich run).
// Run auto-link afterwards to connect api_ids.

export const dynamic = 'force-dynamic'
export const maxDuration = 120

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

function parseAge(row: string): number | null {
  const m = row.match(/\(age[^\)]*?(\d{1,2})\)/)
  return m ? parseInt(m[1], 10) : null
}

// Club is the last <td> that isn't a bare number (those are caps/goals)
function parseClub(row: string): string | null {
  const segments = row.split('</td>')
  for (let i = segments.length - 2; i >= 0; i--) {
    const seg = segments[i]
    const tdStart = seg.lastIndexOf('<td')
    if (tdStart === -1) continue
    const tdContent = seg.slice(tdStart)
    const text = stripTags(tdContent).replace(/\s+/g, ' ').trim()
    if (!text || /^\d+$/.test(text)) continue
    if (['GK','DF','MF','FW'].includes(text)) continue
    const linkMatch = tdContent.match(/<a[^>]*>([^<]+)<\/a>/)
    return decodeEntities(linkMatch ? linkMatch[1] : text)
  }
  return null
}

export async function POST() {
  const supabase = createServiceClient()

  try {
    // ── 1. Fetch Wikipedia page ────────────────────────────────
    const res = await fetch('https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_squads', {
      headers: { 'User-Agent': 'Mozilla/5.0 Loop-WC26/1.0' },
      next: { revalidate: 0 },
    })
    if (!res.ok) throw new Error(`Wikipedia fetch failed: ${res.status}`)
    const html = await res.text()

    // ── 2. Load DB teams ───────────────────────────────────────
    const { data: dbTeams } = await supabase.from('teams').select('id, name')
    const teamByName = new Map<string, string>()
    for (const t of dbTeams ?? []) teamByName.set(t.name.toLowerCase(), t.id)

    function findTeamId(wikiName: string): string | null {
      const resolved = NAME_ALIASES[wikiName] ?? wikiName
      return teamByName.get(resolved.toLowerCase()) ?? null
    }

    // ── 3. Load ALL existing players in one query ──────────────
    // Key: "teamId::playerName" → player id
    const { data: existingPlayers } = await supabase
      .from('players')
      .select('id, name, team_id')

    const existingMap = new Map<string, string>()
    for (const p of existingPlayers ?? []) {
      existingMap.set(`${p.team_id}::${p.name}`, p.id)
    }

    // ── 4. Parse Wikipedia HTML ────────────────────────────────
    const parts = html.split('<h3 id="')

    // Collect inserts and updates to batch
    const toInsert: Array<{ name: string; team_id: string; position: string | null; age: number | null; club: string | null }> = []
    const toUpdate: Array<{ id: string; age: number | null; club: string | null }> = []
    const coachUpdates: Array<{ teamId: string; name: string }> = []
    const unmatched: string[] = []

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
      if (coachMatch) coachUpdates.push({ teamId, name: decodeEntities(coachMatch[1]) })

      // Players
      for (const row of sectionHtml.split('<tr class="nat-fs-player">').slice(1)) {
        const posMatch = row.match(/>(GK|DF|MF|FW)<\/a>/)
        const position = posMatch ? (POSITION_MAP[posMatch[1]] ?? posMatch[1]) : null

        const thMatch = row.match(/<th[^>]*scope="row"[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/)
        if (!thMatch) continue
        const name = decodeEntities(thMatch[1])
        if (!name) continue

        const age  = parseAge(row)
        const club = parseClub(row)
        const key  = `${teamId}::${name}`

        const existingId = existingMap.get(key)
        if (existingId) {
          if (age !== null || club !== null) {
            toUpdate.push({ id: existingId, age, club })
          }
        } else {
          toInsert.push({ name, team_id: teamId, position, age, club })
        }
      }
    }

    // ── 5. Batch-write coaches ─────────────────────────────────
    for (const c of coachUpdates) {
      await supabase.from('teams').update({ manager: c.name }).eq('id', c.teamId)
    }

    // ── 6. Batch-insert new players ────────────────────────────
    let inserted = 0
    if (toInsert.length > 0) {
      // Insert in chunks of 100 to stay within Supabase limits
      for (let i = 0; i < toInsert.length; i += 100) {
        const chunk = toInsert.slice(i, i + 100)
        const { error } = await supabase.from('players').insert(chunk)
        if (!error) inserted += chunk.length
      }
    }

    // ── 7. Batch-update existing players (age + club) ──────────
    let enriched = 0
    for (const u of toUpdate) {
      const patch: Record<string, any> = {}
      if (u.age  !== null) patch.age  = u.age
      if (u.club !== null) patch.club = u.club
      if (Object.keys(patch).length === 0) continue
      const { error } = await supabase.from('players').update(patch).eq('id', u.id)
      if (!error) enriched++
    }

    return NextResponse.json({
      message: `Imported ${inserted} new, enriched ${enriched} existing players. Coaches updated. Unmatched teams: ${unmatched.join(', ') || 'none'}`,
      inserted,
      enriched,
      skipped: (existingPlayers?.length ?? 0) - enriched,
      unmatched,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
