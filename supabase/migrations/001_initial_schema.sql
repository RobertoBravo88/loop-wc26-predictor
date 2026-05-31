-- ============================================================
-- Loop World Cup Predictor — Initial Schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TEAMS
-- ============================================================
CREATE TABLE teams (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id        INTEGER UNIQUE,
  name          TEXT NOT NULL,
  short_name    TEXT,
  flag_url      TEXT,
  group_letter  TEXT, -- A through L
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PLAYERS (squads)
-- ============================================================
CREATE TABLE players (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id      INTEGER UNIQUE,
  team_id     UUID REFERENCES teams(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  position    TEXT, -- Goalkeeper, Defender, Midfielder, Forward
  photo_url   TEXT,
  shirt_number INTEGER,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- USER PROFILES (extends Supabase Auth users)
-- ============================================================
CREATE TABLE profiles (
  id                   UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name         TEXT NOT NULL,
  email                TEXT NOT NULL,
  role                 TEXT DEFAULT 'player' CHECK (role IN ('player', 'admin')),
  favourite_team_id    UUID REFERENCES teams(id),
  favourite_player_id  UUID REFERENCES players(id),
  current_streak       INTEGER DEFAULT 0,
  max_streak           INTEGER DEFAULT 0,
  total_points         INTEGER DEFAULT 0,
  secret_revealed      BOOLEAN DEFAULT FALSE, -- flips to true at tournament start
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MATCHES
-- ============================================================
CREATE TABLE matches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id        INTEGER UNIQUE,
  stage         TEXT NOT NULL CHECK (stage IN (
                  'group', 'round_of_32', 'round_of_16', 'quarter_final',
                  'semi_final', 'third_place', 'final'
                )),
  group_letter  TEXT,                          -- only for group stage
  match_number  INTEGER,                        -- 1-104
  home_team_id  UUID REFERENCES teams(id),
  away_team_id  UUID REFERENCES teams(id),
  kickoff_at    TIMESTAMPTZ NOT NULL,
  home_score    INTEGER,                        -- null until played
  away_score    INTEGER,                        -- null until played
  status        TEXT DEFAULT 'scheduled' CHECK (status IN (
                  'scheduled', 'in_play', 'finished', 'postponed', 'cancelled'
                )),
  venue         TEXT,
  result_fetched_at TIMESTAMPTZ,               -- when we last pulled from API
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PREDICTIONS (one per user per match)
-- ============================================================
CREATE TABLE predictions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID REFERENCES profiles(id) ON DELETE CASCADE,
  match_id             UUID REFERENCES matches(id) ON DELETE CASCADE,
  predicted_home       INTEGER NOT NULL,
  predicted_away       INTEGER NOT NULL,
  locked_at            TIMESTAMPTZ,            -- set at kick-off
  is_exact             BOOLEAN,                -- set after match ends
  is_correct_outcome   BOOLEAN,                -- set after match ends
  points_base          INTEGER DEFAULT 0,      -- 100 or 50 or 0
  points_streak_bonus  INTEGER DEFAULT 0,      -- 50 per match in streak ≥3
  points_total         INTEGER DEFAULT 0,      -- base + streak
  processed_at         TIMESTAMPTZ,            -- when points were awarded
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, match_id)
);

-- ============================================================
-- FINALIST PICKS (pre-tournament)
-- ============================================================
CREATE TABLE finalist_picks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  first_team_id   UUID REFERENCES teams(id),
  second_team_id  UUID REFERENCES teams(id),
  third_team_id   UUID REFERENCES teams(id),
  first_correct   BOOLEAN,
  second_correct  BOOLEAN,
  third_correct   BOOLEAN,
  points_awarded  INTEGER DEFAULT 0,
  locked_at       TIMESTAMPTZ,                 -- set at tournament start
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SCORER PICKS (one player per team, per user)
-- ============================================================
CREATE TABLE scorer_picks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES profiles(id) ON DELETE CASCADE,
  team_id         UUID REFERENCES teams(id),
  player_id       UUID REFERENCES players(id),
  goals_counted   INTEGER DEFAULT 0,           -- goals scored during tournament
  points_awarded  INTEGER DEFAULT 0,
  locked_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, team_id)
);

-- ============================================================
-- GOAL EVENTS (pulled from API, used for bonus scoring)
-- ============================================================
CREATE TABLE goal_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id       INTEGER UNIQUE,
  match_id     UUID REFERENCES matches(id) ON DELETE CASCADE,
  player_id    UUID REFERENCES players(id),
  team_id      UUID REFERENCES teams(id),
  minute       INTEGER,
  is_own_goal  BOOLEAN DEFAULT FALSE,
  is_penalty   BOOLEAN DEFAULT FALSE,
  processed    BOOLEAN DEFAULT FALSE,          -- have bonus points been awarded?
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- POINT EVENTS (full audit log of every point awarded)
-- ============================================================
CREATE TABLE point_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN (
                'exact_score',
                'correct_outcome',
                'streak_bonus',
                'scorer_bonus',
                'favourite_team_goal',
                'favourite_player_goal',
                'finalist_first',
                'finalist_second',
                'finalist_third'
              )),
  points      INTEGER NOT NULL,
  match_id    UUID REFERENCES matches(id),
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- NEWS POSTS
-- ============================================================
CREATE TABLE news_posts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id    UUID REFERENCES profiles(id),
  title        TEXT NOT NULL,
  slug         TEXT UNIQUE NOT NULL,
  body         TEXT NOT NULL,
  excerpt      TEXT,
  image_url    TEXT,
  is_published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MATCH REACTIONS (one per user per match)
-- ============================================================
CREATE TABLE match_reactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE,
  match_id   UUID REFERENCES matches(id) ON DELETE CASCADE,
  emoji      TEXT,
  comment    TEXT CHECK (char_length(comment) <= 140),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, match_id)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams           ENABLE ROW LEVEL SECURITY;
ALTER TABLE players         ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches         ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE finalist_picks  ENABLE ROW LEVEL SECURITY;
ALTER TABLE scorer_picks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_posts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_reactions ENABLE ROW LEVEL SECURITY;

-- Teams & Players: public read
CREATE POLICY "teams_public_read"   ON teams   FOR SELECT USING (true);
CREATE POLICY "players_public_read" ON players FOR SELECT USING (true);

-- Matches: public read
CREATE POLICY "matches_public_read" ON matches FOR SELECT USING (true);

-- Goal events: public read
CREATE POLICY "goal_events_public_read" ON goal_events FOR SELECT USING (true);

-- Point events: public read
CREATE POLICY "point_events_public_read" ON point_events FOR SELECT USING (true);

-- Profiles: public read, own write
CREATE POLICY "profiles_public_read"  ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_own_update"   ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_own_insert"   ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Predictions: public read, own insert/update before lock
CREATE POLICY "predictions_public_read" ON predictions FOR SELECT USING (true);
CREATE POLICY "predictions_own_insert"  ON predictions FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "predictions_own_update"  ON predictions FOR UPDATE
  USING (auth.uid() = user_id AND locked_at IS NULL);

-- Finalist picks: public read, own insert/update before tournament start
CREATE POLICY "finalist_picks_public_read" ON finalist_picks FOR SELECT USING (true);
CREATE POLICY "finalist_picks_own_insert"  ON finalist_picks FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "finalist_picks_own_update"  ON finalist_picks FOR UPDATE
  USING (auth.uid() = user_id AND locked_at IS NULL);

-- Scorer picks: public read, own insert/update before tournament start
CREATE POLICY "scorer_picks_public_read" ON scorer_picks FOR SELECT USING (true);
CREATE POLICY "scorer_picks_own_insert"  ON scorer_picks FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "scorer_picks_own_update"  ON scorer_picks FOR UPDATE
  USING (auth.uid() = user_id AND locked_at IS NULL);

-- News posts: read published only; admins write (handled via service role)
CREATE POLICY "news_published_read" ON news_posts FOR SELECT
  USING (is_published = true);

-- Match reactions: public read, own insert/update/delete
CREATE POLICY "reactions_public_read"  ON match_reactions FOR SELECT USING (true);
CREATE POLICY "reactions_own_insert"   ON match_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reactions_own_update"   ON match_reactions FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "reactions_own_delete"   ON match_reactions FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Update profiles.updated_at automatically
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER matches_updated_at
  BEFORE UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER predictions_updated_at
  BEFORE UPDATE ON predictions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- LEADERBOARD VIEW
-- ============================================================
CREATE OR REPLACE VIEW leaderboard AS
SELECT
  p.id,
  p.display_name,
  p.total_points,
  p.current_streak,
  p.max_streak,
  t.name  AS favourite_team_name,
  t.flag_url AS favourite_team_flag,
  RANK() OVER (ORDER BY p.total_points DESC) AS rank,
  COUNT(DISTINCT pr.id) FILTER (WHERE pr.processed_at IS NOT NULL) AS matches_predicted,
  COUNT(DISTINCT pr.id) FILTER (WHERE pr.is_exact = true) AS exact_scores,
  COUNT(DISTINCT pr.id) FILTER (WHERE pr.is_correct_outcome = true AND pr.is_exact = false) AS correct_outcomes
FROM profiles p
LEFT JOIN teams t ON t.id = p.favourite_team_id
LEFT JOIN predictions pr ON pr.user_id = p.id
GROUP BY p.id, p.display_name, p.total_points, p.current_streak, p.max_streak,
         t.name, t.flag_url;

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_predictions_user    ON predictions(user_id);
CREATE INDEX idx_predictions_match   ON predictions(match_id);
CREATE INDEX idx_scorer_picks_user   ON scorer_picks(user_id);
CREATE INDEX idx_point_events_user   ON point_events(user_id);
CREATE INDEX idx_goal_events_match   ON goal_events(match_id);
CREATE INDEX idx_goal_events_player  ON goal_events(player_id);
CREATE INDEX idx_matches_kickoff     ON matches(kickoff_at);
CREATE INDEX idx_matches_status      ON matches(status);
CREATE INDEX idx_news_published      ON news_posts(published_at) WHERE is_published = true;
