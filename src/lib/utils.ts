import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, isPast, isFuture } from 'date-fns'
import type { MatchStage } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatKickoff(dateStr: string) {
  return format(new Date(dateStr), 'dd MMM · HH:mm')
}

export function formatRelative(dateStr: string) {
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
}

/**
 * Returns the current time — or a simulated time if NEXT_PUBLIC_SIMULATION_DATE
 * is set in env vars. Set that variable to any ISO date string (e.g.
 * "2026-06-20T18:00:00Z") to freeze "now" for testing lock states, flag
 * reveals, leaderboard, etc. Remove it to return to real time.
 */
export function getNow(): Date {
  const sim = process.env.NEXT_PUBLIC_SIMULATION_DATE
  if (sim) {
    const d = new Date(sim)
    if (!isNaN(d.getTime())) return d
  }
  return new Date()
}

export function isMatchLocked(kickoffAt: string) {
  return new Date(kickoffAt) <= getNow()
}

export function isTournamentStarted() {
  const start = new Date(process.env.NEXT_PUBLIC_TOURNAMENT_START ?? '2026-06-11T19:00:00Z')
  return getNow() >= start
}

export function stageName(stage: MatchStage): string {
  const map: Record<MatchStage, string> = {
    group: 'Group Stage',
    round_of_32: 'Round of 32',
    round_of_16: 'Round of 16',
    quarter_final: 'Quarter-Final',
    semi_final: 'Semi-Final',
    third_place: '3rd Place Play-off',
    final: 'Final',
  }
  return map[stage]
}

export function outcomeLabel(home: number, away: number): string {
  if (home > away) return 'Home win'
  if (away > home) return 'Away win'
  return 'Draw'
}

export function groupStageOrder(): MatchStage[] {
  return ['group', 'round_of_32', 'round_of_16', 'quarter_final', 'semi_final', 'third_place', 'final']
}
