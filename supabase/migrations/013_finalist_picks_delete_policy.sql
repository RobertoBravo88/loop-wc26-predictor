-- finalist_picks was missing a DELETE RLS policy.
-- Without it, upsert() silently fails on updates because it tries to
-- DELETE the existing row before inserting the updated one.
-- Same fix as migrations 004 (predictions) and 007 (scorer_picks).

CREATE POLICY "finalist_picks_own_delete" ON finalist_picks
  FOR DELETE USING (auth.uid() = user_id);
