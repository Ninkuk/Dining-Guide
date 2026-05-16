// Server-side count of pending Suggestions, used by the AccountMenu to badge
// the "Review suggestions" item. Returns `null` for unauthenticated visitors
// (the menu item is hidden in that case) and a number otherwise — zero stays
// a real value, so the menu still renders the item with no badge text.
//
// Dynamic by design: the count is auth-gated and shouldn't sit inside a
// `'use cache'` boundary. The caller wraps this in `<Suspense>` so the rest
// of the header can stream without waiting on the count query.

import { createClient } from "@/lib/supabase/server";

export async function getPendingSuggestionsCount(): Promise<number | null> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return null;

  const { count, error } = await supabase
    .from("suggestions")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  if (error) {
    console.error("getPendingSuggestionsCount failed:", error);
    return 0;
  }
  return count ?? 0;
}
