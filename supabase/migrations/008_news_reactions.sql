-- News article emoji reactions — one row per user per emoji per post
CREATE TABLE news_reactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES news_posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id)   ON DELETE CASCADE,
  emoji      TEXT NOT NULL CHECK (char_length(emoji) <= 8),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (post_id, user_id, emoji)   -- one of each emoji per user per post
);

ALTER TABLE news_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "news_reactions_public_read" ON news_reactions FOR SELECT USING (true);
CREATE POLICY "news_reactions_own_insert"  ON news_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "news_reactions_own_delete"  ON news_reactions FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_news_reactions_post ON news_reactions(post_id);
