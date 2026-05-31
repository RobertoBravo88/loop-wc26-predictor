-- ============================================================
-- RPC: increment user points atomically
-- ============================================================
CREATE OR REPLACE FUNCTION increment_user_points(p_user_id UUID, p_points INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET total_points = total_points + p_points,
      updated_at   = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- RPC: lock all pre-tournament picks at tournament start
-- ============================================================
CREATE OR REPLACE FUNCTION lock_tournament_picks()
RETURNS VOID AS $$
DECLARE
  now_ts TIMESTAMPTZ := NOW();
BEGIN
  UPDATE finalist_picks SET locked_at = now_ts WHERE locked_at IS NULL;
  UPDATE scorer_picks   SET locked_at = now_ts WHERE locked_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- RPC: reveal secret bonuses (called at tournament start)
-- ============================================================
CREATE OR REPLACE FUNCTION reveal_secret_bonuses()
RETURNS VOID AS $$
BEGIN
  UPDATE profiles SET secret_revealed = TRUE WHERE secret_revealed = FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
