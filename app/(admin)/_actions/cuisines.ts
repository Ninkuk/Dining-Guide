"use server";

import { createClient } from "@/lib/supabase/server";
import { cuisineSchema } from "@/lib/schemas/cuisine";

type ActionResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

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

export async function createCuisine(
  input: unknown,
): Promise<ActionResult<{ name: string; emoji: string }>> {
  assertNotPreview();
  await assertAuthed();

  const parsed = cuisineSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.message };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cuisines")
    .insert({ name: parsed.data.name, emoji: parsed.data.emoji })
    .select()
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, data: { name: data.name, emoji: data.emoji } };
}

/** How many restaurants currently tag this cuisine, plus a few of their names. */
export async function cuisineUsage(name: string): Promise<{ count: number; sample: string[] }> {
  await assertAuthed();

  const supabase = await createClient();
  const { data, count, error } = await supabase
    .from("restaurants")
    .select("name", { count: "exact" })
    .contains("cuisine", [name])
    .order("name", { ascending: true })
    .limit(5);

  if (error) throw new Error(`cuisineUsage failed: ${error.message}`);
  return { count: count ?? 0, sample: (data ?? []).map((r) => r.name) };
}

/**
 * Delete a cuisine. If any restaurants still tag it, strip the tag from them
 * first — there's no FK; the `restaurants_check_cuisines` trigger only validates
 * on restaurant insert/update, so a dangling reference would leave those rows
 * un-editable. Then delete the lookup row.
 */
export async function deleteCuisine(name: string): Promise<ActionResult<{ untaggedFrom: number }>> {
  assertNotPreview();
  await assertAuthed();

  if (typeof name !== "string" || name.trim().length === 0) {
    return { ok: false, error: "Cuisine name is required" };
  }

  const supabase = await createClient();

  const { data: rows, error: selErr } = await supabase
    .from("restaurants")
    .select("id, cuisine")
    .contains("cuisine", [name]);
  if (selErr) return { ok: false, error: selErr.message };

  for (const row of rows ?? []) {
    const next = (row.cuisine ?? []).filter((c) => c !== name);
    const { error: updErr } = await supabase
      .from("restaurants")
      .update({ cuisine: next })
      .eq("id", row.id);
    if (updErr) return { ok: false, error: updErr.message };
  }

  const { error: delErr } = await supabase.from("cuisines").delete().eq("name", name);
  if (delErr) return { ok: false, error: delErr.message };

  return { ok: true, data: { untaggedFrom: rows?.length ?? 0 } };
}
