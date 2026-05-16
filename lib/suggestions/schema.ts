// Suggestion submit validation.
//
// Two payload shapes (Correction, Tip) sit behind a discriminated union keyed
// by `kind`. The Correction payload is bounded by the whitelist in ADR-0001;
// any off-whitelist key is silently stripped by zod's default strip behavior.
// The Tip payload is restaurant-shaped but limited to the same factual subset
// (no notes/pros/cons/recommendations/rating/occasion/wallet/status/visited_at/slug).
//
// The DB doesn't enforce field-level shape on the JSONB `payload` column —
// this Zod parse IS the trust boundary, per ADR-0003.

import { z } from "zod";

// Locations are reused verbatim from the Restaurant form; we accept the same
// shape so the constrained-Combobox + LocationsFieldArray + AddressAutocomplete
// primitives drop in unchanged. Lat/lng coercion mirrors lib/schemas/restaurant.ts.
const suggestionLocationSchema = z.object({
  id: z.number().optional(),
  city: z
    .string()
    .trim()
    .max(120)
    .nullable()
    .optional()
    .transform((v) => v || null),
  locality: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .optional()
    .transform((v) => v || null),
  address: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .optional()
    .transform((v) => v || null),
  latitude: z
    .union([z.number(), z.string(), z.null()])
    .optional()
    .transform((v) => {
      if (v == null || v === "") return null;
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : null;
    })
    .pipe(z.number().min(-90).max(90).nullable()),
  longitude: z
    .union([z.number(), z.string(), z.null()])
    .optional()
    .transform((v) => {
      if (v == null || v === "") return null;
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : null;
    })
    .pipe(z.number().min(-180).max(180).nullable()),
});

// triState used inside a Correction payload — preserves undefined so a sparse
// Correction can mean "I have no input on this field" vs "set this to null".
// An empty string from a radio "Unknown" coerces to null (an explicit clear).
// `.transform().optional()` (in that order) keeps the field optional in the
// output object type — `.optional().transform()` makes it required-but-undefined.
const triStateCorrection = z
  .union([z.enum(["yes", "no"]), z.literal(""), z.null()])
  .transform((v) => (v === "" || v === null ? null : v))
  .optional();

// triState for a Tip payload — Tips are full proposals, so an absent value
// collapses to null (the field is being set to "unknown").
const triStateTip = z
  .union([z.enum(["yes", "no"]), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v === "" || v == null ? null : v));

// ADR-0001 — exact set of fields a Correction may propose. `anything_else` is
// included here as a payload key for forms that route it through `payload`;
// the submit action also accepts it as a top-level Suggestion field (the DB
// stores it in its own column), so both paths are valid.
export const CORRECTION_WHITELIST = [
  "name",
  "permanently_closed",
  "cuisine",
  "vegetarian",
  "locations",
  "photo_url",
  "anything_else",
] as const;

export type CorrectionWhitelistField = (typeof CORRECTION_WHITELIST)[number];

const correctionPayloadShape = {
  name: z.string().trim().min(1).max(200).optional(),
  permanently_closed: z.boolean().optional(),
  cuisine: z.array(z.string().trim().min(1)).optional(),
  vegetarian: triStateCorrection,
  locations: z.array(suggestionLocationSchema).optional(),
  // photo_url stays sparse-friendly: undefined stays undefined; an explicit null
  // is "clear the photo"; a URL passes through unchanged.
  photo_url: z.union([z.string().url(), z.null()]).optional(),
  anything_else: z.string().max(5_000).optional(),
};

// strict() would error on extras; we want silent strip per ADR-0001's
// "Zod parse strips off-whitelist fields" — so default behavior is correct.
export const correctionPayloadSchema = z.object(correctionPayloadShape);

export type CorrectionPayload = z.output<typeof correctionPayloadSchema>;

// Tip payload — restaurant-shaped but limited to the factual subset. Everything
// editorial-voice or personal-context is off-limits.
const tipPayloadShape = {
  name: z.string().trim().min(1, "Name is required").max(200),
  cuisine: z.array(z.string().trim().min(1)).optional().default([]),
  vegetarian: triStateTip,
  permanently_closed: z.boolean().optional().default(false),
  photo_url: z
    .string()
    .url()
    .nullable()
    .optional()
    .transform((v) => v || null),
  locations: z.array(suggestionLocationSchema).optional().default([]),
  anything_else: z.string().max(5_000).optional(),
};

export const tipPayloadSchema = z.object(tipPayloadShape);

export type TipPayload = z.output<typeof tipPayloadSchema>;

// Top-level Suggestion. Two structural invariants beyond the kind discriminator:
// a Correction MUST target a restaurant; a Tip MUST NOT. These mirror the SQL
// CHECK constraints in 0010_suggestions_table.sql so the server action and the
// DB agree on the same shape.
const suggestionBase = {
  submitter_name: z.string().trim().min(1, "Tell me who you are").max(120),
  anything_else: z
    .string()
    .max(5_000)
    .nullable()
    .optional()
    .transform((v) => v || null),
  photo_path: z
    .string()
    .max(500)
    .nullable()
    .optional()
    .transform((v) => v || null),
};

export const suggestionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("correction"),
    // A Correction must target a real restaurant id.
    target_restaurant_id: z.number().int().positive(),
    payload: correctionPayloadSchema,
    ...suggestionBase,
  }),
  z.object({
    kind: z.literal("tip"),
    // A Tip must NOT carry a target (it proposes a new restaurant).
    target_restaurant_id: z
      .union([z.literal(null), z.undefined()])
      .optional()
      .transform(() => null),
    payload: tipPayloadSchema,
    ...suggestionBase,
  }),
]);

export type SuggestionInput = z.input<typeof suggestionSchema>;
export type Suggestion = z.output<typeof suggestionSchema>;
