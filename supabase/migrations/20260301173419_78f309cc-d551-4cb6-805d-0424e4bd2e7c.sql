
-- ===== ENUMS =====
CREATE TYPE public.user_role AS ENUM ('OWNER','ADMIN','STAFF','ACCOUNTANT','DRIVER');
CREATE TYPE public.shop_type AS ENUM ('GODOWN','SHOP');
CREATE TYPE public.buyer_category AS ENUM ('DEALER','RETAILER','WALKIN');
CREATE TYPE public.product_category AS ENUM ('Dhuli','Dryfruits','Oil','Other');
CREATE TYPE public.inventory_change_type AS ENUM ('RECEIVED','SOLD','ADJUSTED','DISPATCHED');
CREATE TYPE public.order_channel AS ENUM ('MANUAL','WALKIN');
CREATE TYPE public.order_status AS ENUM ('PENDING','CONFIRMED','DISPATCHED','DELIVERED','CANCELLED');
CREATE TYPE public.payment_status AS ENUM ('PENDING','PARTIAL','PAID');
CREATE TYPE public.delivery_slot AS ENUM ('MORNING','AFTERNOON','EVENING');
CREATE TYPE public.bill_status AS ENUM ('PENDING','BILLED','SENT');
CREATE TYPE public.notification_type AS ENUM ('BILLING','LOW_STOCK','ORDER','DISPATCH');
CREATE TYPE public.dispatch_status AS ENUM ('PLANNED','IN_TRANSIT','COMPLETED','CANCELLED');
CREATE TYPE public.dispatch_stop_status AS ENUM ('PENDING','DELIVERED','FAILED');

-- ===== SHOPS =====
CREATE TABLE public.shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type shop_type NOT NULL DEFAULT 'SHOP',
  address TEXT,
  city TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read shops" ON public.shops FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin insert shops" ON public.shops FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin update shops" ON public.shops FOR UPDATE TO authenticated USING (true);

-- ===== BRANDS =====
CREATE TABLE public.brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read brands" ON public.brands FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin insert brands" ON public.brands FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin update brands" ON public.brands FOR UPDATE TO authenticated USING (true);

-- ===== APP USERS =====
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role user_role NOT NULL DEFAULT 'STAFF',
  assigned_shop_id UUID REFERENCES public.shops(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read users" ON public.users FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own" ON public.users FOR UPDATE TO authenticated USING (auth.uid() = auth_user_id);
CREATE POLICY "Insert own user" ON public.users FOR INSERT TO authenticated WITH CHECK (auth.uid() = auth_user_id);

-- ===== BUYERS =====
CREATE TABLE public.buyers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  category buyer_category NOT NULL DEFAULT 'RETAILER',
  address TEXT,
  gstin TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.buyers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read buyers" ON public.buyers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert buyers" ON public.buyers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update buyers" ON public.buyers FOR UPDATE TO authenticated USING (true);

-- ===== PRODUCTS =====
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  brand_id UUID REFERENCES public.brands(id),
  category product_category NOT NULL DEFAULT 'Other',
  unit TEXT NOT NULL DEFAULT 'pcs',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read products" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update products" ON public.products FOR UPDATE TO authenticated USING (true);

-- ===== INVENTORY =====
CREATE TABLE public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) NOT NULL,
  product_id UUID REFERENCES public.products(id) NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  min_threshold NUMERIC NOT NULL DEFAULT 10,
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by_user_id UUID REFERENCES public.users(id),
  UNIQUE(shop_id, product_id)
);
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read inventory" ON public.inventory FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert inventory" ON public.inventory FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update inventory" ON public.inventory FOR UPDATE TO authenticated USING (true);

-- ===== INVENTORY LOGS =====
CREATE TABLE public.inventory_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) NOT NULL,
  product_id UUID REFERENCES public.products(id) NOT NULL,
  change_type inventory_change_type NOT NULL,
  quantity_change NUMERIC NOT NULL,
  note TEXT,
  created_by_user_id UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read inventory_logs" ON public.inventory_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert inventory_logs" ON public.inventory_logs FOR INSERT TO authenticated WITH CHECK (true);

-- ===== PRICE LISTS =====
CREATE TABLE public.price_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by_user_id UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.price_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read price_lists" ON public.price_lists FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert price_lists" ON public.price_lists FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update price_lists" ON public.price_lists FOR UPDATE TO authenticated USING (true);

-- ===== PRODUCT PRICES =====
CREATE TABLE public.product_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_list_id UUID REFERENCES public.price_lists(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) NOT NULL,
  buyer_category buyer_category NOT NULL,
  price_per_unit NUMERIC NOT NULL,
  UNIQUE(price_list_id, product_id, buyer_category)
);
ALTER TABLE public.product_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read product_prices" ON public.product_prices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert product_prices" ON public.product_prices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update product_prices" ON public.product_prices FOR UPDATE TO authenticated USING (true);

-- ===== ORDERS =====
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID REFERENCES public.buyers(id) NOT NULL,
  channel order_channel NOT NULL DEFAULT 'MANUAL',
  created_by_user_id UUID REFERENCES public.users(id),
  shop_id UUID REFERENCES public.shops(id),
  delivery_date DATE,
  delivery_slot delivery_slot,
  status order_status NOT NULL DEFAULT 'PENDING',
  payment_status payment_status NOT NULL DEFAULT 'PENDING',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read orders" ON public.orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update orders" ON public.orders FOR UPDATE TO authenticated USING (true);

-- ===== ORDER ITEMS =====
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) NOT NULL,
  requested_qty NUMERIC NOT NULL DEFAULT 0,
  allocated_qty NUMERIC NOT NULL DEFAULT 0,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  line_total NUMERIC NOT NULL DEFAULT 0
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read order_items" ON public.order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert order_items" ON public.order_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update order_items" ON public.order_items FOR UPDATE TO authenticated USING (true);

-- ===== WALKIN PURCHASES =====
CREATE TABLE public.walkin_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID REFERENCES public.buyers(id),
  buyer_name_override TEXT,
  buyer_phone_override TEXT,
  shop_id UUID REFERENCES public.shops(id),
  created_by_user_id UUID REFERENCES public.users(id),
  total_amount NUMERIC NOT NULL DEFAULT 0,
  photo_proof_url TEXT,
  bill_status bill_status NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.walkin_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read walkin_purchases" ON public.walkin_purchases FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert walkin_purchases" ON public.walkin_purchases FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update walkin_purchases" ON public.walkin_purchases FOR UPDATE TO authenticated USING (true);

-- ===== WALKIN ITEMS =====
CREATE TABLE public.walkin_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  walkin_purchase_id UUID REFERENCES public.walkin_purchases(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  line_total NUMERIC NOT NULL DEFAULT 0
);
ALTER TABLE public.walkin_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read walkin_items" ON public.walkin_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert walkin_items" ON public.walkin_items FOR INSERT TO authenticated WITH CHECK (true);

-- ===== NOTIFICATIONS =====
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID REFERENCES public.users(id) NOT NULL,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  reference_id UUID,
  reference_type TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own notifications" ON public.notifications FOR SELECT TO authenticated
  USING (recipient_user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));
CREATE POLICY "Auth insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE TO authenticated
  USING (recipient_user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

-- ===== DISPATCHES =====
CREATE TABLE public.dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id),
  driver_user_id UUID REFERENCES public.users(id),
  start_shop_id UUID REFERENCES public.shops(id),
  dispatch_date DATE NOT NULL DEFAULT CURRENT_DATE,
  vehicle_id TEXT,
  status dispatch_status NOT NULL DEFAULT 'PLANNED',
  total_distance_km NUMERIC,
  total_duration_min NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.dispatches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read dispatches" ON public.dispatches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert dispatches" ON public.dispatches FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update dispatches" ON public.dispatches FOR UPDATE TO authenticated USING (true);

-- ===== DISPATCH STOPS =====
CREATE TABLE public.dispatch_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id UUID REFERENCES public.dispatches(id) ON DELETE CASCADE NOT NULL,
  buyer_id UUID REFERENCES public.buyers(id),
  address TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  stop_sequence INT NOT NULL DEFAULT 0,
  items_summary JSONB,
  status dispatch_stop_status NOT NULL DEFAULT 'PENDING',
  completed_at TIMESTAMPTZ
);
ALTER TABLE public.dispatch_stops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read dispatch_stops" ON public.dispatch_stops FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert dispatch_stops" ON public.dispatch_stops FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update dispatch_stops" ON public.dispatch_stops FOR UPDATE TO authenticated USING (true);

-- ===== Update handle_new_user to also create app user =====
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
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email, 'STAFF');
  
  RETURN NEW;
END;
$$;
