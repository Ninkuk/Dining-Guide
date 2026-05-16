"use server";

import { redirect, RedirectType } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { restaurantSchema, type Restaurant } from "@/lib/schemas/restaurant";
import { geocodeSearch } from "@/lib/geocode";
import { isValidSlug } from "@/lib/slug";

type ActionResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fields?: Record<string, string[]> };

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

// Auto-geocode any location missing lat/lng before insert. Called server-side
// as a safety net; the form usually fills these via the autocomplete.
async function fillMissingGeocodes(r: Restaurant): Promise<Restaurant> {
  const filled = await Promise.all(
    r.locations.map(async (loc) => {
      if (loc.latitude != null && loc.longitude != null) return loc;
      const query = [loc.locality, loc.city, "AZ", "USA"].filter(Boolean).join(", ");
      if (!query || query === "AZ, USA") return loc;
      try {
        const hit = await geocodeSearch(query);
        if (!hit) return loc;
        return {
          ...loc,
          latitude: hit.latitude,
          longitude: hit.longitude,
          address: loc.address ?? hit.display_name,
        };
      } catch {
        return loc;
      }
    }),
  );
  return { ...r, locations: filled };
}

export async function createRestaurant(
  input: unknown,
  options: { fromSuggestionId?: number } = {},
): Promise<ActionResult<{ slug: string }>> {
  assertNotPreview();
  await assertAuthed();

  const parsed = restaurantSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Validation failed", fields: parsed.error.flatten().fieldErrors };
  }

  if (!isValidSlug(parsed.data.slug)) {
    return {
      ok: false,
      error: "Slug is invalid or reserved",
      fields: { slug: ["Invalid or reserved"] },
    };
  }

  const enriched = await fillMissingGeocodes(parsed.data);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("upsert_restaurant_with_locations", {
    payload: enriched as unknown as Parameters<typeof supabase.rpc>[1] extends { payload: infer P }
      ? P
      : never,
  });

  if (error) {
    console.error("createRestaurant rpc error:", error);
    return { ok: false, error: error.message };
  }

  // Accept-flow: if this Restaurant came from a Suggestion, mark it accepted.
  // Best-effort per ADR-0002 — if this fails, the Restaurant write already
  // succeeded, the Suggestion stays pending, and the admin can manually reject.
  if (options.fromSuggestionId != null && Number.isInteger(options.fromSuggestionId)) {
    const { error: ackErr } = await supabase
      .from("suggestions")
      .update({ status: "accepted", decided_at: new Date().toISOString() })
      .eq("id", options.fromSuggestionId)
      .eq("status", "pending");
    if (ackErr) {
      console.error(
        "createRestaurant: failed to mark suggestion accepted (restaurant was still created):",
        ackErr,
      );
    }
  }

  const finalSlug = await fetchSlugById(Number(data));
  redirect(`/${finalSlug ?? enriched.slug}`, RedirectType.replace);
}

export async function updateRestaurant(
  input: unknown,
  options: { fromSuggestionId?: number } = {},
): Promise<ActionResult<{ slug: string }>> {
  assertNotPreview();
  await assertAuthed();

  const parsed = restaurantSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Validation failed", fields: parsed.error.flatten().fieldErrors };
  }
  if (parsed.data.id == null) {
    return { ok: false, error: "Missing id" };
  }
  if (!isValidSlug(parsed.data.slug)) {
    return {
      ok: false,
      error: "Slug is invalid or reserved",
      fields: { slug: ["Invalid or reserved"] },
    };
  }

  const enriched = await fillMissingGeocodes(parsed.data);

  const supabase = await createClient();
  const { error } = await supabase.rpc("upsert_restaurant_with_locations", {
    payload: enriched as unknown as Parameters<typeof supabase.rpc>[1] extends { payload: infer P }
      ? P
      : never,
  });

  if (error) {
    console.error("updateRestaurant rpc error:", error);
    return { ok: false, error: error.message };
  }

  // Accept-flow: mirror createRestaurant. Best-effort per ADR-0002.
  if (options.fromSuggestionId != null && Number.isInteger(options.fromSuggestionId)) {
    const { error: ackErr } = await supabase
      .from("suggestions")
      .update({ status: "accepted", decided_at: new Date().toISOString() })
      .eq("id", options.fromSuggestionId)
      .eq("status", "pending");
    if (ackErr) {
      console.error(
        "updateRestaurant: failed to mark suggestion accepted (restaurant was still updated):",
        ackErr,
      );
    }
  }

  redirect(`/${enriched.slug}`, RedirectType.replace);
}

export async function deleteRestaurant(formData: FormData): Promise<void> {
  assertNotPreview();
  await assertAuthed();

  const idRaw = formData.get("id");
  const id = Number(idRaw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Invalid id");
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("restaurants")
    .select("photo_url")
    .eq("id", id)
    .maybeSingle();

  if (existing?.photo_url) {
    const path = extractStoragePath(existing.photo_url);
    if (path) {
      await supabase.storage.from("restaurant-photos").remove([path]);
    }
  }

  const { error } = await supabase.from("restaurants").delete().eq("id", id);
  if (error) {
    console.error("deleteRestaurant error:", error);
    throw new Error(error.message);
  }

  redirect("/", RedirectType.replace);
}

/**
 * Remove an old photo from storage and replace `photo_url` with a new public URL.
 * Used when the user uploads a new photo on the edit page.
 */
export async function replacePhoto(
  restaurantId: number,
  newPublicUrl: string,
  previousPublicUrl: string | null,
): Promise<ActionResult> {
  assertNotPreview();
  await assertAuthed();

  const supabase = await createClient();

  if (previousPublicUrl && previousPublicUrl !== newPublicUrl) {
    const path = extractStoragePath(previousPublicUrl);
    if (path) await supabase.storage.from("restaurant-photos").remove([path]);
  }

  const { error } = await supabase
    .from("restaurants")
    .update({ photo_url: newPublicUrl })
    .eq("id", restaurantId);

  if (error) {
    console.error("replacePhoto error:", error);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

function extractStoragePath(publicUrl: string): string | null {
  // Public URLs look like: <SUPABASE_URL>/storage/v1/object/public/restaurant-photos/<path>
  try {
    const u = new URL(publicUrl);
    const marker = "/storage/v1/object/public/restaurant-photos/";
    const idx = u.pathname.indexOf(marker);
    if (idx === -1) return null;
    return u.pathname.slice(idx + marker.length);
  } catch {
    return null;
  }
}

async function fetchSlugById(id: number): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("restaurants").select("slug").eq("id", id).maybeSingle();
  return data?.slug ?? null;
}
