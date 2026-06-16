-- Drop policies if they exist, then create them to avoid conflicts
DROP POLICY IF EXISTS "Auth delete buyers" ON public.buyers;
CREATE POLICY "Auth delete buyers" ON public.buyers 
  FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth delete orders" ON public.orders;
CREATE POLICY "Auth delete orders" ON public.orders 
  FOR DELETE TO authenticated USING (true);

-- Alter orders foreign key to buyers to cascade delete
ALTER TABLE public.orders 
  DROP CONSTRAINT IF EXISTS orders_buyer_id_fkey;

ALTER TABLE public.orders 
  ADD CONSTRAINT orders_buyer_id_fkey 
  FOREIGN KEY (buyer_id) REFERENCES public.buyers(id) 
  ON DELETE CASCADE;

-- Alter dispatch_stops foreign key to buyers to cascade delete
ALTER TABLE public.dispatch_stops 
  DROP CONSTRAINT IF EXISTS dispatch_stops_buyer_id_fkey;

ALTER TABLE public.dispatch_stops 
  ADD CONSTRAINT dispatch_stops_buyer_id_fkey 
  FOREIGN KEY (buyer_id) REFERENCES public.buyers(id) 
  ON DELETE CASCADE;
