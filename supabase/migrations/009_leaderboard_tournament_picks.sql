-- Add tournament_picks_done to leaderboard view
-- Counts: finalist picks (0-3) + scorer picks (0-5) + fav team (0-1) + fav player (0-1) = max 10
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

  COUNT(DISTINCT pr.id)                                                              AS matches_predicted,
  COUNT(DISTINCT pr.id) FILTER (WHERE pr.is_exact = true)                           AS exact_scores,
  COUNT(DISTINCT pr.id) FILTER (WHERE pr.is_correct_outcome = true
                                  AND pr.is_exact = false)                          AS correct_outcomes,
  COALESCE(SUM(pr.points_base), 0)         AS prediction_points,
  COALESCE(SUM(pr.points_streak_bonus), 0) AS streak_points,
  COALESCE(pe_bonus.bonus_points, 0)        AS bonus_points,

  -- How many of the 10 tournament picks the user has filled in
  COALESCE(
    (CASE WHEN fp.first_team_id  IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN fp.second_team_id IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN fp.third_team_id  IS NOT NULL THEN 1 ELSE 0 END) +
    COALESCE(sp_cnt.scorer_count, 0) +
    (CASE WHEN p.favourite_team_id   IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN p.favourite_player_id IS NOT NULL THEN 1 ELSE 0 END),
  0)                                        AS tournament_picks_done

FROM profiles p
LEFT JOIN teams t ON t.id = p.favourite_team_id
LEFT JOIN predictions pr ON pr.user_id = p.id
LEFT JOIN (
  SELECT user_id, SUM(points) AS bonus_points
  FROM point_events
  WHERE type IN (
    'scorer_bonus', 'favourite_team_goal', 'favourite_player_goal',
    'finalist_first', 'finalist_second', 'finalist_third'
  )
  GROUP BY user_id
) pe_bonus ON pe_bonus.user_id = p.id
LEFT JOIN finalist_picks fp ON fp.user_id = p.id
LEFT JOIN (
  SELECT user_id, LEAST(COUNT(*), 5) AS scorer_count
  FROM scorer_picks
  GROUP BY user_id
) sp_cnt ON sp_cnt.user_id = p.id
GROUP BY
  p.id, p.display_name, p.total_points, p.current_streak, p.max_streak,
  t.name, t.flag_url, pe_bonus.bonus_points,
  fp.first_team_id, fp.second_team_id, fp.third_team_id,
  sp_cnt.scorer_count;
