import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Cookie-free Supabase client for purely public reads. `lib/supabase/server.ts`
 * reads `cookies()`, which is overkill when the call is gated entirely by the
 * RLS `*_public_read` policies. Construct fresh per call — Fluid Compute reuses
 * function instances; a fresh client per call keeps the surface obvious.
 */
export function createAnonClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
