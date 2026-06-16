-- Drop existing owner policy if exists
DROP POLICY IF EXISTS "Owners can update any user" ON public.users;

-- Create policy for OWNER to update other users
CREATE POLICY "Owners can update any user" ON public.users
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_user_id = auth.uid() AND role = 'OWNER'
    )
  );
