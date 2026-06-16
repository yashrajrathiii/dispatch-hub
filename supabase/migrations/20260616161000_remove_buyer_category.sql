-- 1. Remove category from buyers
ALTER TABLE public.buyers DROP COLUMN IF EXISTS category;

-- 2. Modify product_prices
-- Drop the constraint first
ALTER TABLE public.product_prices DROP CONSTRAINT IF EXISTS product_prices_price_list_id_product_id_buyer_category_key;

-- Since multiple categories might have duplicate rows, keep only one row per (price_list_id, product_id) before dropping the column
DELETE FROM public.product_prices a USING public.product_prices b
WHERE a.id > b.id 
  AND a.price_list_id = b.price_list_id 
  AND a.product_id = b.product_id;

-- Drop the column
ALTER TABLE public.product_prices DROP COLUMN IF EXISTS buyer_category;

-- Add new unique constraint
ALTER TABLE public.product_prices ADD CONSTRAINT product_prices_price_list_id_product_id_key UNIQUE (price_list_id, product_id);

-- 3. Drop type
DROP TYPE IF EXISTS public.buyer_category;
