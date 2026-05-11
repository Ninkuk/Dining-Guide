// Cuisine display data — seed for the `cuisines` lookup table (Decision 26).
//
// Once Phase 3's `cuisines` migration runs, the DB becomes the source of truth and
// this map serves as the seed list + a fallback used by the migration script when
// upserting cuisines encountered in the CSV.

const FALLBACK_EMOJI = '🍽️'

// Keys are the canonical (case-sensitive) names stored in restaurants.cuisine[]
// and in cuisines.name once the table exists.
export const CUISINE_EMOJI: Record<string, string> = {
  American: '🇺🇸',
  BBQ: '🍖',
  Bakery: '🥐',
  Bar: '🍸',
  Boba: '🧋',
  Brazilian: '🇧🇷',
  Breakfast: '🥞',
  Brewery: '🍺',
  British: '🫖',
  Brunch: '🥂',
  Burger: '🍔',
  Cafe: '🥯',
  Cajun: '🦐',
  Caribbean: '🏝️',
  Chinese: '🥡',
  Coffee: '☕',
  Cuban: '🇨🇺',
  Desserts: '🍰',
  Diner: '🍳',
  Donuts: '🍩',
  Ethiopian: '🇪🇹',
  Filipino: '🇵🇭',
  French: '🥖',
  German: '🥨',
  Greek: '🇬🇷',
  Hawaiian: '🌺',
  'Ice Cream': '🍦',
  Indian: '🍛',
  Irish: '☘️',
  Italian: '🍝',
  Japanese: '🍣',
  Korean: '🥢',
  Lebanese: '🥙',
  Mediterranean: '🫒',
  Mexican: '🌮',
  'Middle Eastern': '🧆',
  Mongolian: '🍲',
  Persian: '🍆',
  Peruvian: '🦙',
  Pizza: '🍕',
  Polish: '🥟',
  Ramen: '🍜',
  Salads: '🥗',
  Sandwiches: '🥪',
  Seafood: '🦞',
  Soul: '🍗',
  Spanish: '🇪🇸',
  Steakhouse: '🥩',
  Sushi: '🍣',
  Tapas: '🍢',
  'Tex-Mex': '🌶️',
  Thai: '🥥',
  Vegan: '🌱',
  Vegetarian: '🥦',
  Vietnamese: '🍜',
}

export function getCuisineEmoji(name: string): string {
  return CUISINE_EMOJI[name] ?? FALLBACK_EMOJI
}

export function getKnownCuisines(): readonly string[] {
  return Object.keys(CUISINE_EMOJI).sort()
}

/** Return cuisines from `incoming` that aren't in CUISINE_EMOJI yet. Used by migration script. */
export function findUnknownCuisines(incoming: readonly string[]): string[] {
  return Array.from(new Set(incoming)).filter((c) => !(c in CUISINE_EMOJI)).sort()
}
