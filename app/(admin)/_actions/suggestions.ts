"use server";

// Admin-side Suggestion actions. Reject is the one explicit Suggestion-only
// action; accept happens via the existing edit/new form per ADR-0002.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { discardPhoto } from "@/lib/suggestions/photo-quarantine";

type ActionResult = { ok: true } | { ok: false; error: string };

function assertNotPreview() {
  if (process.env.VERCEL_ENV === "preview") {
    throw new Error("Writes are disabled on preview deployments.");
  }
}

async function assertAuthed() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    throw new Error("Unauthenticated");
  }
}

/**
 * Mark a pending Suggestion as rejected. Optional `reason` lands in `admin_note`.
 * No notification is sent to the submitter (we never had their email).
 *
 * If the Suggestion carried a quarantine photo, discard it immediately
 * (ADR-0003 — abandoned anonymous content should not linger). The discard is
 * best-effort: a Storage failure logs a warning but does not block the
 * rejection; the daily cron sweeps orphans either way.
 */
export async function rejectSuggestion(formData: FormData): Promise<ActionResult> {
  assertNotPreview();
  await assertAuthed();

  const idRaw = formData.get("id");
  const id = Number(idRaw);
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, error: "Invalid id" };
  }
  const reason = String(formData.get("reason") ?? "").trim();

  const supabase = await createClient();

  // Look up the photo path FIRST — we need it after the status update.
  const { data: existing } = await supabase
    .from("suggestions")
    .select("photo_path, status")
    .eq("id", id)
    .maybeSingle();
  if (existing && existing.status !== "pending") {
    // Already decided — nothing to do; mirror the no-op behavior the update
    // below would have had (the `.eq('status', 'pending')` filter would have
    // matched zero rows). Still revalidate so the queue refreshes if needed.
    revalidatePath("/suggestions");
    return { ok: true };
  }

  const { error } = await supabase
    .from("suggestions")
    .update({
      status: "rejected",
      admin_note: reason || null,
      decided_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "pending"); // don't re-decide an already-decided one

  if (error) {
    console.error("rejectSuggestion error:", error);
    return { ok: false, error: error.message };
  }

  // Discard the quarantine photo, if any. Best-effort.
  if (existing?.photo_path) {
    await discardPhoto(supabase.storage, existing.photo_path);
  }

  revalidatePath("/suggestions");
  return { ok: true };
}
