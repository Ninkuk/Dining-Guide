// Restaurant + locations validation (single source of truth, shared between
// React Hook Form on the client and the server action's re-validation).
//
// The shape mirrors the upsert RPC's expected JSONB payload.

import { z } from "zod";
import { FORBIDDEN_SLUGS } from "@/lib/slug";

const OCCASIONS = ["Quick", "Casual", "Elevated", "Fine Dine"] as const;
const WALLETS = ["Cheap", "Normal", "Splurge", "Big night"] as const;
const STATUSES = ["visited", "want_to_try"] as const;
const TRI_STATE = ["yes", "no"] as const;

// Nullable enums: form sends "" (or "unset") for "no choice"; transform to null.
const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .union([z.enum(values), z.literal(""), z.null()])
    .transform((v) => (v === "" || v == null ? null : v));

const triState = z
  .union([z.enum(TRI_STATE), z.literal(""), z.null()])
  .transform((v) => (v === "" || v == null ? null : v));

export const locationSchema = z.object({
  id: z.number().optional(), // present on edit (existing rows)
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

export type LocationInput = z.input<typeof locationSchema>;
export type Location = z.output<typeof locationSchema>;

export const restaurantSchema = z.object({
  id: z.number().optional(),
  name: z.string().trim().min(1, "Name is required").max(200),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug must be kebab-case")
    .refine((s) => !(FORBIDDEN_SLUGS as readonly string[]).includes(s), "Slug is reserved"),
  cuisine: z.array(z.string().trim().min(1)).default([]),
  occasion: optionalEnum(OCCASIONS),
  wallet: optionalEnum(WALLETS),
  rating: z
    .union([z.number().int().min(1).max(5), z.null()])
    .optional()
    .transform((v) => (v == null ? null : v)),
  vegetarian: triState,
  permanently_closed: z.boolean().default(false),
  status: z.enum(STATUSES).default("visited"),
  visited_at: z
    .union([z.string(), z.date(), z.null()])
    .optional()
    .transform((v) => {
      if (!v) return null;
      if (v instanceof Date) return v.toISOString().slice(0, 10);
      return v;
    }),
  photo_url: z
    .string()
    .url()
    .nullable()
    .optional()
    .transform((v) => v || null),
  notes: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((v) => v || null),
  pros: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((v) => v || null),
  cons: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((v) => v || null),
  recommendations: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((v) => v || null),
  locations: z.array(locationSchema).default([]),
});

export type RestaurantInput = z.input<typeof restaurantSchema>;
export type Restaurant = z.output<typeof restaurantSchema>;

export const OCCASION_VALUES = OCCASIONS;
export const WALLET_VALUES = WALLETS;
