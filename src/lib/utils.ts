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

export function isMatchLocked(kickoffAt: string) {
  return isPast(new Date(kickoffAt))
}

export function isTournamentStarted() {
  const start = new Date(process.env.NEXT_PUBLIC_TOURNAMENT_START ?? '2026-06-11T16:00:00Z')
  return isPast(start)
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
