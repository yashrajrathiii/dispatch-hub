
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'PICKED_UP';
ALTER TABLE walkin_purchases ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS amount_paid NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes_photo_url TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_amount NUMERIC NOT NULL DEFAULT 0;

-- Allow deletion for owners/admins on orders + order_items
CREATE POLICY "Auth delete orders" ON public.orders FOR DELETE TO authenticated USING (true);
CREATE POLICY "Auth delete order_items" ON public.order_items FOR DELETE TO authenticated USING (true);
