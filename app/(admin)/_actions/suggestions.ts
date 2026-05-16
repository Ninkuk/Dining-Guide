"use server";

// Admin-side Suggestion actions. v1 covers reject only — accept happens via
// the existing edit/new form per ADR-0002 (later slice).

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

  revalidatePath("/suggestions");
  return { ok: true };
}
