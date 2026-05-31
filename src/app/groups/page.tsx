import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export const revalidate = 60

const GROUPS = ['A','B','C','D','E','F','G','H','I','J','K','L']

export default async function GroupsPage() {
  const supabase = await createClient()

  const { data: teams } = await supabase
    .from('teams')
    .select('*')
    .order('group_letter')
    .order('name')

  const byGroup = new Map<string, any[]>()
  for (const team of teams ?? []) {
    if (!team.group_letter) continue
    if (!byGroup.has(team.group_letter)) byGroup.set(team.group_letter, [])
    byGroup.get(team.group_letter)!.push(team)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Group Stage</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {GROUPS.map(g => {
          const groupTeams = byGroup.get(g) ?? []
          return (
            <Link key={g} href={`/groups/${g}`}
              className="bg-white rounded-2xl border border-gray-100 p-4 hover:border-[#ff5c35]/40 hover:shadow-sm transition-all group">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-[#ff5c35] text-white flex items-center justify-center text-xs font-bold">
                    {g}
                  </span>
                  <span className="font-semibold text-gray-800">Group {g}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#ff5c35] transition-colors" />
              </div>
              <div className="space-y-1.5">
                {groupTeams.length > 0 ? groupTeams.map((t: any) => (
                  <div key={t.id} className="flex items-center gap-2">
                    {t.flag_url && <img src={t.flag_url} alt="" className="w-5 h-3.5 object-cover rounded-sm" />}
                    <span className="text-sm text-gray-600">{t.name}</span>
                  </div>
                )) : (
                  <p className="text-xs text-gray-400">Teams TBD</p>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
