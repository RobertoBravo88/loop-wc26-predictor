-- Admin-only simulation table for the Match Centre preview.
-- Only ever has 1 row (deleted and re-inserted on each save).
CREATE TABLE match_centre_preview (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id    UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  home_score  INTEGER NOT NULL DEFAULT 0,
  away_score  INTEGER NOT NULL DEFAULT 0,
  state       TEXT NOT NULL DEFAULT 'live', -- 'upcoming'|'preview'|'live'|'finished'
  goal_events JSONB NOT NULL DEFAULT '[]',  -- [{minute, player_name, team_id, is_own_goal}]
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Only admins can read/write (via service client in API routes)
ALTER TABLE match_centre_preview ENABLE ROW LEVEL SECURITY;
