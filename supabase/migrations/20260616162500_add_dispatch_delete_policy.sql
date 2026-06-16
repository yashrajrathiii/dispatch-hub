-- Add DELETE policy for dispatches
CREATE POLICY "Auth delete dispatches" ON public.dispatches 
  FOR DELETE TO authenticated USING (true);

-- Add DELETE policy for dispatch_stops
CREATE POLICY "Auth delete dispatch_stops" ON public.dispatch_stops 
  FOR DELETE TO authenticated USING (true);
