-- Two-table player architecture: api_players stores api-football data,
-- players stores our clean text-file data. players.api_id is the link.

CREATE TABLE api_players (
  api_id       INTEGER PRIMARY KEY,
  name         TEXT NOT NULL,
  team_id      UUID REFERENCES teams(id),
  shirt_number INTEGER,
  photo_url    TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE api_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "api_players_public_read" ON api_players FOR SELECT USING (true);
CREATE INDEX idx_api_players_team ON api_players(team_id);

-- Store raw api-football scorer ID in goal events so unlinked goals
-- can be retroactively processed after a player gets linked
ALTER TABLE goal_events ADD COLUMN IF NOT EXISTS api_player_api_id INTEGER;

-- Clean up the messy current player state (both sets will be reimported cleanly)
-- Admin will run: Reset & Import → Sync squads → Auto-link internal
DELETE FROM scorer_picks;
UPDATE profiles SET favourite_player_id = NULL;
UPDATE goal_events SET player_id = NULL, api_player_api_id = NULL;
DELETE FROM players;
