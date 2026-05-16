import { AccountMenu } from "@/components/AccountMenu";
import { createClient } from "@/lib/supabase/server";

/**
 * Auth-aware wrapper for the global account menu. Reads cookies via getClaims();
 * render inside <Suspense> at the call site so the rest of the shell can stream.
 */
export async function AccountMenuSlot() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return <AccountMenu signedIn={!!data?.claims} />;
}
