# Migrate to your own Supabase project

## Important caveat

Lovable Cloud cannot be turned off on this project — the auto-generated `src/integrations/supabase/client.ts` and `src/integrations/supabase/types.ts` will keep pointing at the Cloud backend. To use your own Supabase we will:

1. Create a **new client file** (e.g. `src/lib/supabase.ts`) wired to your project's URL + anon key.
2. Switch every app import from `@/integrations/supabase/client` to the new file.
3. Leave the Cloud files untouched (they'll just be unused).

Your Supabase URL and anon key (publishable) will be hardcoded in the new client file — both are safe to ship in frontend code. The GitHub connection on your Supabase project doesn't change anything here; it only affects how *you* push schema migrations from your repo if you choose to.

## Steps

### 1. Collect target project details
I'll need from you (paste in chat):
- Supabase **Project URL** (e.g. `https://xxxx.supabase.co`)
- Supabase **anon/publishable key**
- Confirmation that **Email auth** is enabled in your project (Authentication → Providers)

### 2. Recreate the schema in your Supabase
I'll generate one consolidated SQL file containing everything currently in Lovable Cloud:
- Enums: `app_role`, `user_role`, `buyer_category`, `product_category`, `shop_type`, `order_status`, `payment_status`, `order_channel`, `delivery_slot`, `bill_status`, `dispatch_status`, `dispatch_stop_status`, notification type, inventory change_type
- Tables: `brands`, `buyers`, `products`, `shops`, `inventory`, `inventory_logs`, `price_lists`, `product_prices`, `orders`, `order_items`, `walkin_purchases`, `walkin_items`, `dispatches`, `dispatch_stops`, `notifications`, `users`, `profiles`
- Functions: `handle_new_user`, `update_updated_at_column`
- Trigger on `auth.users` for new-user profile creation
- All RLS policies and GRANTs (matching what's listed in this context)
- Storage bucket: `walkin-proofs` (public)

You'll run this file in your Supabase SQL editor (or commit it as a migration in the connected GitHub repo).

### 3. Export data from Lovable Cloud → import into your project
I'll dump every table to CSV in `/mnt/documents/` (you download the zip), then provide matching `COPY ... FROM` SQL you run in your project. Order respects dependencies (brands → products → inventory, buyers → orders → order_items, etc.). `auth.users` rows cannot be transferred via SQL — existing users will need to **sign up again** in the new project (their `profiles`/`users` rows will be recreated via the trigger; we can then re-link historical records by email).

### 4. Edge function + storage
- Recreate the `ors-proxy` edge function in your project (I'll provide the code + `supabase functions deploy` instructions); add `ORS_API_KEY` as a secret there.
- Storage bucket `walkin-proofs` created in step 2.

### 5. Switch the app to the new client
- Create `src/lib/supabase.ts` exporting a client built from your URL + anon key.
- Replace every `from "@/integrations/supabase/client"` import (Dashboard, Inventory, Orders, OrderDetail, WalkinPurchase, PriceList, Dispatch, DriverView, Buyers, Settings, Auth pages, AppSidebar, etc.) with the new path.
- Update edge-function invocations to call your project's function URL.
- Keep `src/integrations/supabase/types.ts` for typing (regenerate locally with `supabase gen types typescript` against your project and overwrite, since the file is now decoupled from Cloud).

### 6. Verify
- Sign up a test user → confirm `profiles` + `users` rows created.
- Load Dashboard → counts query your DB.
- Create a product, place an order, verify inventory deducts.

## Technical notes

- New client file pattern:
  ```ts
  import { createClient } from "@supabase/supabase-js";
  export const supabase = createClient("https://YOUR.supabase.co", "YOUR_ANON_KEY");
  ```
- After import, run `SELECT setval(...)` is not needed (all PKs are `gen_random_uuid()`).
- Re-linking historical `users.auth_user_id` to newly created auth users will be done with an `UPDATE ... FROM auth.users WHERE email = email` script after each person signs in once.

## What I need from you to start
Reply with your Supabase **Project URL** and **anon key**, and confirm email auth is enabled.