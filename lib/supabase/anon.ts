import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

/**
 * Cookie-free Supabase client for use inside `'use cache'` boundaries.
 *
 * `lib/supabase/server.ts` reads `cookies()`, which is request-bound and
 * therefore can't be called from cached functions. Public reads are gated by
 * the RLS `*_public_read` policies, so an anon client is sufficient.
 *
 * Construct fresh per call (Fluid Compute reuses function instances; sharing
 * a client across requests is fine for stateless reads but a fresh one keeps
 * the surface obvious).
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
    }
  )
}
