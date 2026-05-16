import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

// Admin: bypasses RLS. Server only — never expose to clients.
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
);
// Anon: respects RLS. Use for user-level operations.
export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
);
