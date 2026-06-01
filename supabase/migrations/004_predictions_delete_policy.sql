-- Allow users to delete their own predictions (e.g. clearing both score inputs)
-- Previously missing — RLS was silently blocking all client-side deletes.
CREATE POLICY "predictions_own_delete" ON predictions FOR DELETE
  USING (auth.uid() = user_id);
