import { z } from 'zod'

// The create-cuisine dialog: name is a plain word, emoji optional (defaults to 🍽️).
// Reject Extended Pictographic chars in the name — emoji belongs in `emoji`.

const EMOJI_IN_NAME = /\p{Extended_Pictographic}/u

export const cuisineSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(60)
    .refine((s) => !EMOJI_IN_NAME.test(s), 'Name cannot contain emojis'),
  emoji: z
    .string()
    .trim()
    .max(6) // most emojis are 1–4 code points; allow ZWJ sequences
    .default('🍽️')
    .transform((v) => v || '🍽️'),
})

export type CuisineInput = z.input<typeof cuisineSchema>
export type Cuisine = z.output<typeof cuisineSchema>
