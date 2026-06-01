-- Make goal bonus point_events idempotent by linking each event to the
-- specific goal that triggered it. This allows reprocessGoalBonuses() to
-- safely re-run for any match at any time — after a player is linked,
-- after a manual admin trigger, etc. — without double-awarding points.
--
-- Run this in the Supabase SQL editor.

-- Add goal_event_id to point_events (nullable — prediction events don't have one)
ALTER TABLE point_events
  ADD COLUMN IF NOT EXISTS goal_event_id UUID REFERENCES goal_events(id);

-- Unique constraint: one bonus of each type per user per goal event
-- Prevents double-awarding even if the function is called multiple times
CREATE UNIQUE INDEX IF NOT EXISTS point_events_goal_bonus_unique
  ON point_events(user_id, goal_event_id, type)
  WHERE goal_event_id IS NOT NULL;
