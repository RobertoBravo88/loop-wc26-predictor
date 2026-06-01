import { redirect } from 'next/navigation'

export default function TournamentPicksPage() {
  redirect('/predictions?tab=tournament')
}
