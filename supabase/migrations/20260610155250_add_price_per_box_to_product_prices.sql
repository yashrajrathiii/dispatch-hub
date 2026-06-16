-- Add price_per_box column to product_prices table
ALTER TABLE public.product_prices ADD COLUMN price_per_box NUMERIC NULL;
