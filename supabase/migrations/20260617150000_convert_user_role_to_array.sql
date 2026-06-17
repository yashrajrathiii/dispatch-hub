-- Drop policy first
DROP POLICY IF EXISTS "Owners can update any user" ON public.users;

-- Drop default value first to avoid casting error during type conversion
ALTER TABLE public.users ALTER COLUMN role DROP DEFAULT;

-- Convert column type to array
ALTER TABLE public.users ALTER COLUMN role TYPE public.user_role[] USING ARRAY[role]::public.user_role[];

-- Set default value
ALTER TABLE public.users ALTER COLUMN role SET DEFAULT '{STAFF}'::public.user_role[];

-- Update handle_new_user trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  
  INSERT INTO public.users (auth_user_id, name, email, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email, ARRAY['STAFF']::public.user_role[]);
  
  RETURN NEW;
END;
$$;

-- Re-create Owners policy using ANY
CREATE POLICY "Owners can update any user" ON public.users
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_user_id = auth.uid() AND 'OWNER' = ANY(role)
    )
  );
