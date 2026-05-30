// App's Supabase client — points at the user's own Supabase project.
// The auto-generated client at src/integrations/supabase/client.ts is intentionally
// unused; do not import from it.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const SUPABASE_URL = "https://zhfhjfhzrdngmjxqezxl.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_ZxuQSYQxrUUiT8el61ju_w_-RyKy566";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
