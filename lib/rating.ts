// Star characters ↔ int conversion.
//
// `★` filled / `☆` outlined. The CSV uses these characters in the Rating column.
// The DB stores rating as smallint 0..5 or NULL. By convention, all-outlined
// (zero filled) means "unrated" and maps to NULL — see migration rule §3.2.

const FILLED = "★";
const OUTLINED = "☆";
export const MAX_RATING = 5;

/**
 * Count `★` chars in the input. Returns null when none are present (the
 * "unrated" convention) so callers can distinguish from an explicit zero.
 */
export function starsToInt(stars: string): number | null {
  const filled = (stars.match(/★/g) ?? []).length;
  if (filled === 0) return null;
  return Math.min(MAX_RATING, filled);
}

/** Inverse: render a rating as a 5-character ★/☆ string. NULL → all outlined. */
export function intToStars(n: number | null | undefined): string {
  if (n == null) return OUTLINED.repeat(MAX_RATING);
  const safe = Math.max(0, Math.min(MAX_RATING, Math.round(n)));
  return FILLED.repeat(safe) + OUTLINED.repeat(MAX_RATING - safe);
}
