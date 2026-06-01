-- ============================================================
-- Leaderboard view: add prediction_points, streak_points,
-- bonus_points columns and fix matches_predicted to count
-- all submitted predictions (not just processed ones).
-- ============================================================
CREATE OR REPLACE VIEW leaderboard AS
SELECT
  p.id,
  p.display_name,
  p.total_points,
  p.current_streak,
  p.max_streak,
  t.name      AS favourite_team_name,
  t.flag_url  AS favourite_team_flag,
  RANK() OVER (ORDER BY p.total_points DESC) AS rank,

  -- All submitted predictions (regardless of whether results are in)
  COUNT(DISTINCT pr.id)                                                              AS matches_predicted,
  COUNT(DISTINCT pr.id) FILTER (WHERE pr.is_exact = true)                           AS exact_scores,
  COUNT(DISTINCT pr.id) FILTER (WHERE pr.is_correct_outcome = true
                                  AND pr.is_exact = false)                          AS correct_outcomes,

  -- Points breakdown
  COALESCE(SUM(pr.points_base), 0)         AS prediction_points,
  COALESCE(SUM(pr.points_streak_bonus), 0) AS streak_points,
  COALESCE(pe_bonus.bonus_points, 0)        AS bonus_points

FROM profiles p
LEFT JOIN teams t ON t.id = p.favourite_team_id
LEFT JOIN predictions pr ON pr.user_id = p.id
LEFT JOIN (
  SELECT user_id, SUM(points) AS bonus_points
  FROM point_events
  WHERE type IN (
    'scorer_bonus',
    'favourite_team_goal',
    'favourite_player_goal',
    'finalist_first',
    'finalist_second',
    'finalist_third'
  )
  GROUP BY user_id
) pe_bonus ON pe_bonus.user_id = p.id
GROUP BY
  p.id, p.display_name, p.total_points, p.current_streak, p.max_streak,
  t.name, t.flag_url, pe_bonus.bonus_points;
