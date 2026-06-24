-- Create check_clearances table
CREATE TABLE public.check_clearances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  party_name TEXT NOT NULL,
  buyer_id UUID REFERENCES public.buyers(id) ON DELETE SET NULL,
  check_number TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  cleared BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.check_clearances ENABLE ROW LEVEL SECURITY;

-- Create policy for OWNER role
CREATE POLICY "Owners can manage check_clearances" ON public.check_clearances
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_user_id = auth.uid() AND 'OWNER' = ANY(role)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_user_id = auth.uid() AND 'OWNER' = ANY(role)
    )
  );
