-- Bug 5 fix: enforce kick-off time server-side so a user with a wrong
-- device clock cannot submit or change a prediction after the match starts.
--
-- Also backfills locked_at for existing finalist_picks rows (Bug 4 fix).
-- locked_at was never set by any code, so the engine skipped all Crystal
-- Ball picks. The engine has been updated to not require locked_at, but
-- set it anyway for completeness and audit trail.
--
-- Run this in the Supabase SQL editor.

-- ── Backfill locked_at for all existing complete finalist picks ──────────────
UPDATE finalist_picks
SET locked_at = NOW()
WHERE locked_at IS NULL
  AND first_team_id  IS NOT NULL
  AND second_team_id IS NOT NULL
  AND third_team_id  IS NOT NULL;

-- ── Server-side kick-off lock for predictions ────────────────────────────────
DROP POLICY IF EXISTS "predictions_own_insert" ON predictions;
DROP POLICY IF EXISTS "predictions_own_update" ON predictions;

CREATE POLICY "predictions_own_insert" ON predictions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = match_id
        AND matches.kickoff_at > now()
        AND matches.status = 'scheduled'
    )
  );

CREATE POLICY "predictions_own_update" ON predictions FOR UPDATE
  USING (
    auth.uid() = user_id
    AND locked_at IS NULL
    AND EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = match_id
        AND matches.kickoff_at > now()
        AND matches.status = 'scheduled'
    )
  );
