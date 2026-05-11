import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Uses service role key — bypasses RLS. Auth is handled by Firebase.
export async function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
