-- Allow users to delete their own scorer picks (remove a player from Golden Boots squad)
-- Without this RLS policy, the delete call silently succeeds but removes nothing.
CREATE POLICY "scorer_picks_own_delete" ON scorer_picks FOR DELETE
  USING (auth.uid() = user_id);
