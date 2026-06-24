export interface SlotInfo {
  label: string
  team?: string
  flagUrl?: string | null
  confirmed: boolean
}

export type GroupLeaders = Record<string, {
  p1?: string
  p2?: string
  p1Flag?: string | null
  p2Flag?: string | null
  complete: boolean
}>

export const R32_SLOT_MAP: Record<number, [string, string]> = {
  73: ['A2', 'B2'],
  74: ['E1', '3rd'],
  75: ['F1', 'C2'],
  76: ['C1', 'F2'],
  77: ['I1', '3rd'],
  78: ['E2', 'I2'],
  79: ['A1', '3rd'],
  80: ['L1', '3rd'],
  81: ['D1', '3rd'],
  82: ['G1', '3rd'],
  83: ['K2', 'L2'],
  84: ['H1', 'J2'],
  85: ['B1', '3rd'],
  86: ['J1', 'H2'],
  87: ['K1', '3rd'],
  88: ['D2', 'G2'],
}

export function resolveSlot(slot: string, leaders: GroupLeaders): SlotInfo {
  if (!slot || slot === '3rd') return { label: 'Best 3rd place', confirmed: false }
  const m = slot.match(/^([A-L])([12])$/)
  if (!m) return { label: slot, confirmed: false }
  const group = m[1], pos = m[2]
  const g = leaders[group]
  const team = pos === '1' ? g?.p1 : g?.p2
  const flagUrl = pos === '1' ? g?.p1Flag : g?.p2Flag
  return {
    label: `Group ${group} ${pos === '1' ? 'winner' : 'runner-up'}`,
    team,
    flagUrl,
    confirmed: g?.complete ?? false,
  }
}
