import { AccountMenu } from "@/components/AccountMenu";
import { getPendingSuggestionsCount } from "@/components/SuggestionsCountSlot";
import { createClient } from "@/lib/supabase/server";

/**
 * Auth-aware wrapper for the global account menu. Reads cookies via getClaims();
 * render inside <Suspense> at the call site so the rest of the shell can stream.
 * When the visitor is the admin, also fetches the pending Suggestions count so
 * the menu can badge the "Review suggestions" item.
 */
export async function AccountMenuSlot() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const signedIn = !!data?.claims;
  const pendingCount = signedIn ? await getPendingSuggestionsCount() : null;
  return <AccountMenu signedIn={signedIn} pendingCount={pendingCount} />;
}
