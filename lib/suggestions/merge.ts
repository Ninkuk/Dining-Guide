// Apply a Correction payload to a live Restaurant row (merge), or compute a
// structured diff between the two (diff). Pure functions — no DB access here.
//
// Sparse semantics: a missing key in the payload means "no change"; an
// explicit `null` means "set this field to null" (clear it).
//
// `anything_else` is not a structural field — it lands on the Suggestion row,
// not on the Restaurant — so it's deliberately excluded from both merge and
// diff outputs.

import type { CorrectionPayload, TipPayload } from "./schema";

export type LiveLocation = {
  id?: number;
  city: string | null;
  locality: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type LiveRestaurant = {
  id: number;
  slug: string;
  name: string;
  cuisine: string[];
  vegetarian: string | null;
  permanently_closed: boolean;
  photo_url: string | null;
  locations: LiveLocation[];
};

const MERGEABLE_FIELDS = [
  "name",
  "permanently_closed",
  "cuisine",
  "vegetarian",
  "photo_url",
  "locations",
] as const;

type MergeableField = (typeof MERGEABLE_FIELDS)[number];

/**
 * Overlay the named fields from `payload` onto `live`. Returns a new object;
 * the input is not mutated. Fields absent from `payload` stay at the live
 * value; fields explicitly set to `null` (where the schema allows) clear.
 */
export function mergeCorrection(live: LiveRestaurant, payload: CorrectionPayload): LiveRestaurant {
  const out: LiveRestaurant = {
    ...live,
    cuisine: [...live.cuisine],
    locations: live.locations.map((l) => ({ ...l })),
  };
  for (const f of MERGEABLE_FIELDS) {
    const proposed = (payload as Record<string, unknown>)[f];
    if (proposed === undefined) continue;
    (out as Record<string, unknown>)[f] = proposed;
  }
  return out;
}

/**
 * Merging a Tip is the identity — the Tip payload IS the proposed Restaurant
 * record. Returned by reference to make this obvious.
 */
export function mergeTip(payload: TipPayload): TipPayload {
  return payload;
}

export type FieldChange = { field: MergeableField; from: unknown; to: unknown };

/**
 * Return the list of mergeable fields whose proposed value differs from the
 * live value. Sparse (undefined) keys are skipped — they aren't a change.
 * Array comparison is order-sensitive (matches the merge semantics).
 */
export function diffCorrection(live: LiveRestaurant, payload: CorrectionPayload): FieldChange[] {
  const out: FieldChange[] = [];
  for (const f of MERGEABLE_FIELDS) {
    const proposed = (payload as Record<string, unknown>)[f];
    if (proposed === undefined) continue;
    const current = (live as Record<string, unknown>)[f];
    if (!deepEqual(current, proposed)) {
      out.push({ field: f, from: current, to: proposed });
    }
  }
  return out;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (typeof a === "object" && typeof b === "object") {
    const ak = Object.keys(a).sort();
    const bk = Object.keys(b).sort();
    if (ak.length !== bk.length) return false;
    if (!ak.every((k, i) => k === bk[i])) return false;
    return ak.every((k) =>
      deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
    );
  }
  return false;
}
