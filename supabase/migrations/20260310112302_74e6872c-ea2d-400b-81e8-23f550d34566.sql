
CREATE POLICY "Auth delete inventory" ON public.inventory FOR DELETE TO authenticated USING (true);
CREATE POLICY "Auth delete products" ON public.products FOR DELETE TO authenticated USING (true);
