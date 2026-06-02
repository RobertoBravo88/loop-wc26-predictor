// ============================================================
// Loop World Cup Predictor — Shared Types
// ============================================================

export type UserRole = 'player' | 'admin'

export type MatchStage =
  | 'group'
  | 'round_of_32'
  | 'round_of_16'
  | 'quarter_final'
  | 'semi_final'
  | 'third_place'
  | 'final'

export type MatchStatus = 'scheduled' | 'in_play' | 'finished' | 'postponed' | 'cancelled'

export type PointEventType =
  | 'exact_score'
  | 'correct_outcome'
  | 'streak_bonus'
  | 'scorer_bonus'
  | 'favourite_team_goal'
  | 'favourite_player_goal'
  | 'finalist_first'
  | 'finalist_second'
  | 'finalist_third'

// ============================================================
// Database row types
// ============================================================

export interface Team {
  id: string
  api_id: number | null
  name: string
  short_name: string | null
  flag_url: string | null
  group_letter: string | null
  manager: string | null
  created_at: string
}

export interface Player {
  id: string
  api_id: number | null
  team_id: string
  name: string
  position: string | null
  photo_url: string | null
  shirt_number: number | null
  created_at: string
  team?: Team
}

export interface Profile {
  id: string
  display_name: string
  email: string
  role: UserRole
  favourite_team_id: string | null
  favourite_player_id: string | null
  current_streak: number
  max_streak: number
  total_points: number
  secret_revealed: boolean
  created_at: string
  updated_at: string
  favourite_team?: Team
  favourite_player?: Player
}

export interface Match {
  id: string
  api_id: number | null
  stage: MatchStage
  group_letter: string | null
  match_number: number | null
  home_team_id: string | null
  away_team_id: string | null
  kickoff_at: string
  home_score: number | null
  away_score: number | null
  status: MatchStatus
  venue: string | null
  result_fetched_at: string | null
  created_at: string
  updated_at: string
  home_team?: Team
  away_team?: Team
}

export interface Prediction {
  id: string
  user_id: string
  match_id: string
  predicted_home: number
  predicted_away: number
  locked_at: string | null
  is_exact: boolean | null
  is_correct_outcome: boolean | null
  points_base: number
  points_streak_bonus: number
  points_total: number
  processed_at: string | null
  created_at: string
  updated_at: string
  match?: Match
  user?: Profile
}

export interface FinalistPick {
  id: string
  user_id: string
  first_team_id: string | null
  second_team_id: string | null
  third_team_id: string | null
  first_correct: boolean | null
  second_correct: boolean | null
  third_correct: boolean | null
  points_awarded: number
  locked_at: string | null
  created_at: string
  updated_at: string
  first_team?: Team
  second_team?: Team
  third_team?: Team
}

export interface ScorerPick {
  id: string
  user_id: string
  team_id: string
  player_id: string
  goals_counted: number
  points_awarded: number
  locked_at: string | null
  created_at: string
  updated_at: string
  team?: Team
  player?: Player
}

export interface GoalEvent {
  id: string
  api_id: number | null
  match_id: string
  player_id: string | null
  team_id: string
  minute: number | null
  is_own_goal: boolean
  is_penalty: boolean
  processed: boolean
  created_at: string
  player?: Player
  team?: Team
}

export interface PointEvent {
  id: string
  user_id: string
  type: PointEventType
  points: number
  match_id: string | null
  description: string | null
  created_at: string
  match?: Match
}

export interface NewsPost {
  id: string
  author_id: string
  title: string
  slug: string
  body: string
  excerpt: string | null
  image_url: string | null
  is_published: boolean
  published_at: string | null
  created_at: string
  updated_at: string
  author?: Profile
}

export interface MatchReaction {
  id: string
  user_id: string
  match_id: string
  emoji: string | null
  comment: string | null
  created_at: string
  updated_at: string
  user?: Profile
}

// ============================================================
// Leaderboard view
// ============================================================

export interface LeaderboardEntry {
  id: string
  display_name: string
  total_points: number
  current_streak: number
  max_streak: number
  favourite_team_name: string | null
  favourite_team_flag: string | null
  rank: number
  matches_predicted: number
  exact_scores: number
  correct_outcomes: number
  prediction_points: number
  streak_points: number
  bonus_points: number
  tournament_picks_done: number
}

// ============================================================
// Helper / computed types
// ============================================================

export interface GroupStanding {
  team: Team
  played: number
  won: number
  drawn: number
  lost: number
  goals_for: number
  goals_against: number
  goal_difference: number
  points: number
}

export interface PredictedGroupStanding extends GroupStanding {
  predicted: true
}

export const POINTS = {
  EXACT_SCORE: 100,
  CORRECT_OUTCOME: 50,
  STREAK_BONUS: 50,         // per match from 3rd in a row
  SCORER_BONUS_PER_GOAL: 10,
  FAVOURITE_TEAM_PER_GOAL: 10,
  FAVOURITE_PLAYER_PER_GOAL: 20,
  FINALIST_FIRST: 300,
  FINALIST_SECOND: 200,
  FINALIST_THIRD: 100,
  STREAK_STARTS_AT: 3,      // streak bonus kicks in from match 3
} as const

