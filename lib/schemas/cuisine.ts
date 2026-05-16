import { z } from "zod";
import { titleCase } from "@/lib/cuisines";

// The create-cuisine dialog: name is a plain word, emoji optional (defaults to 🍽️).
// Reject Extended Pictographic chars in the name — emoji belongs in `emoji`.
// The name is title-cased so the vocabulary stays consistent regardless of how
// it was typed (the client title-cases too, this is the server-side guarantee).

const EMOJI_IN_NAME = /\p{Extended_Pictographic}/u;

export const cuisineSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(60)
    .refine((s) => !EMOJI_IN_NAME.test(s), "Name cannot contain emojis")
    .transform((s) => titleCase(s)),
  emoji: z
    .string()
    .trim()
    .max(16) // 1–4 code points usually; ZWJ sequences (e.g. 🧑‍🍳) can run longer
    .default("🍽️")
    .transform((v) => v || "🍽️"),
});

export type CuisineInput = z.input<typeof cuisineSchema>;
export type Cuisine = z.output<typeof cuisineSchema>;
