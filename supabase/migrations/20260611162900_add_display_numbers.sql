-- 1. Create sequences starting at 1001
CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 1001;
CREATE SEQUENCE IF NOT EXISTS dispatch_number_seq START WITH 1001;
CREATE SEQUENCE IF NOT EXISTS walkin_number_seq START WITH 1001;
CREATE SEQUENCE IF NOT EXISTS buyer_number_seq START WITH 1001;

-- 2. Add columns as nullable text
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_number text;
ALTER TABLE public.dispatches ADD COLUMN IF NOT EXISTS dispatch_number text;
ALTER TABLE public.walkin_purchases ADD COLUMN IF NOT EXISTS walkin_number text;
ALTER TABLE public.buyers ADD COLUMN IF NOT EXISTS buyer_number text;

-- 3. Populate existing rows sequentially by creation date
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.orders WHERE order_number IS NULL ORDER BY created_at LOOP
        UPDATE public.orders SET order_number = 'ORD-' || nextval('order_number_seq')::text WHERE id = r.id;
    END LOOP;
END $$;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.dispatches WHERE dispatch_number IS NULL ORDER BY created_at LOOP
        UPDATE public.dispatches SET dispatch_number = 'DSP-' || nextval('dispatch_number_seq')::text WHERE id = r.id;
    END LOOP;
END $$;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.walkin_purchases WHERE walkin_number IS NULL ORDER BY created_at LOOP
        UPDATE public.walkin_purchases SET walkin_number = 'WKN-' || nextval('walkin_number_seq')::text WHERE id = r.id;
    END LOOP;
END $$;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.buyers WHERE buyer_number IS NULL ORDER BY created_at LOOP
        UPDATE public.buyers SET buyer_number = 'BYR-' || nextval('buyer_number_seq')::text WHERE id = r.id;
    END LOOP;
END $$;

-- 4. Apply DEFAULT, NOT NULL, and UNIQUE constraints
ALTER TABLE public.orders ALTER COLUMN order_number SET DEFAULT ('ORD-' || nextval('order_number_seq')::text);
ALTER TABLE public.orders ALTER COLUMN order_number SET NOT NULL;
ALTER TABLE public.orders ADD CONSTRAINT orders_order_number_key UNIQUE (order_number);

ALTER TABLE public.dispatches ALTER COLUMN dispatch_number SET DEFAULT ('DSP-' || nextval('dispatch_number_seq')::text);
ALTER TABLE public.dispatches ALTER COLUMN dispatch_number SET NOT NULL;
ALTER TABLE public.dispatches ADD CONSTRAINT dispatches_dispatch_number_key UNIQUE (dispatch_number);

ALTER TABLE public.walkin_purchases ALTER COLUMN walkin_number SET DEFAULT ('WKN-' || nextval('walkin_number_seq')::text);
ALTER TABLE public.walkin_purchases ALTER COLUMN walkin_number SET NOT NULL;
ALTER TABLE public.walkin_purchases ADD CONSTRAINT walkin_purchases_walkin_number_key UNIQUE (walkin_number);

ALTER TABLE public.buyers ALTER COLUMN buyer_number SET DEFAULT ('BYR-' || nextval('buyer_number_seq')::text);
ALTER TABLE public.buyers ALTER COLUMN buyer_number SET NOT NULL;
ALTER TABLE public.buyers ADD CONSTRAINT buyers_buyer_number_key UNIQUE (buyer_number);

-- 5. Make email nullable in public.users to support staff without email ids
ALTER TABLE public.users ALTER COLUMN email DROP NOT NULL;
