// Slug generation and validation.
//
// Kept in sync with the Postgres CHECK constraints in
// supabase/migrations/0001_init.sql:
//   - restaurants_slug_kebab        (regex)
//   - restaurants_slug_not_reserved (FORBIDDEN_SLUGS)
// If you change either side, change both.

export const FORBIDDEN_SLUGS = ['map', 'stats', 'new', 'api', 'auth'] as const
export type ForbiddenSlug = (typeof FORBIDDEN_SLUGS)[number]

const KEBAB_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/
// "Combining Diacritical Marks" block. NFKD splits accents into base + one of
// these (e.g. "é" → "e" + U+0301 acute), so stripping this range removes them.
const COMBINING_MARKS = /[̀-ͯ]/g

/**
 * Normalize a name to a kebab-case slug. No external dep:
 *   1. NFKD-decompose accented chars (é → e + combining acute)
 *   2. Strip combining marks
 *   3. Lowercase
 *   4. Collapse any run of non-alphanumerics to a single `-`
 *   5. Trim leading/trailing `-`
 */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function isForbiddenSlug(slug: string): boolean {
  return (FORBIDDEN_SLUGS as readonly string[]).includes(slug)
}

export function isValidSlug(slug: string): boolean {
  return KEBAB_REGEX.test(slug) && !isForbiddenSlug(slug)
}
