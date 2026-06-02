export interface BadgeDef {
  id: string
  emoji: string
  name: string
  desc: string
  rarity: 'common' | 'uncommon' | 'rare' | 'very_rare'
}

export const BADGE_DEFS: BadgeDef[] = [
  { id: 'first_blood',  emoji: '🎯', name: 'First Blood',   desc: 'Earned your first correct outcome',                    rarity: 'common'    },
  { id: 'sharpshooter', emoji: '💯', name: 'Sharpshooter',  desc: 'Nailed your first exact score',                        rarity: 'common'    },
  { id: 'on_fire',      emoji: '🔥', name: 'On Fire',       desc: '3 exact scores in a row',                              rarity: 'uncommon'  },
  { id: 'unstoppable',  emoji: '⚡', name: 'Unstoppable',   desc: '5 exact scores in a row',                              rarity: 'rare'      },
  { id: 'oracle',       emoji: '🔮', name: 'Oracle',        desc: 'All 3 Crystal Ball picks correct',                     rarity: 'very_rare' },
  { id: 'talent_scout', emoji: '👟', name: 'Talent Scout',  desc: 'A Golden Boot pick scored 5+ goals in the tournament', rarity: 'rare'      },
  { id: 'twelfth_man',  emoji: '🏴', name: '12th Man',      desc: 'Your favourite team scored 10+ goals in the tournament',rarity: 'uncommon'  },
  { id: 'committed',    emoji: '📋', name: 'Committed',     desc: 'Predicted every single group stage match',             rarity: 'uncommon'  },
  { id: 'champion',     emoji: '🏆', name: 'Champion',      desc: 'Finished #1 on the leaderboard',                      rarity: 'very_rare' },
  { id: 'lucky_devil',  emoji: '🎲', name: 'Lucky Devil',   desc: 'Exact score on a match with 5+ total goals',           rarity: 'rare'      },
]

export const BADGE_MAP = Object.fromEntries(BADGE_DEFS.map(b => [b.id, b]))

export const RARITY_ORDER: Record<BadgeDef['rarity'], number> = { common: 4, uncommon: 3, rare: 2, very_rare: 1 }
