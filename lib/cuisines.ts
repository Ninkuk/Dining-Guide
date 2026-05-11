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

/**
 * Curated palette for the "new cuisine" emoji picker — food, drink, place, and
 * origin-flag glyphs only, not the whole Unicode set. Grouped for scanning.
 * (Superset of the values in CUISINE_EMOJI plus sensible extras.)
 */
export const CUISINE_EMOJI_CHOICES: readonly { label: string; emojis: readonly string[] }[] = [
  {
    label: 'Dishes',
    emojis: [
      '🍽️', '🍴', '🥄', '🍛', '🍚', '🍜', '🍝', '🍲', '🥘', '🥣',
      '🍣', '🍱', '🍙', '🍢', '🥟', '🥡', '🍤', '🍕', '🍔', '🌭',
      '🥪', '🌮', '🌯', '🫔', '🥙', '🧆', '🥗', '🍳', '🥓', '🥩',
      '🍖', '🍗', '🦴', '🦐', '🦞', '🦀', '🦪', '🐟', '🍠', '🍿',
    ],
  },
  {
    label: 'Produce',
    emojis: [
      '🥑', '🍆', '🥒', '🥬', '🥦', '🌶️', '🫑', '🌽', '🥕', '🧅',
      '🧄', '🥔', '🍅', '🍄', '🫒', '🌰', '🥜', '🫘',
    ],
  },
  {
    label: 'Bread & sweets',
    emojis: [
      '🍞', '🥖', '🥐', '🥨', '🥯', '🫓', '🧇', '🥞', '🧈', '🧀',
      '🍰', '🎂', '🧁', '🥧', '🍮', '🍪', '🍩', '🍫', '🍬', '🍭',
      '🍡', '🍦', '🍨', '🍧', '🥮', '🍯',
    ],
  },
  {
    label: 'Drinks',
    emojis: [
      '☕', '🍵', '🫖', '🧋', '🧃', '🥤', '🥛', '🍶', '🍾', '🍷',
      '🍸', '🍹', '🍺', '🍻', '🥂', '🥃', '🧉', '🫗',
    ],
  },
  {
    label: 'Fruit & place',
    emojis: [
      '🍇', '🍈', '🍉', '🍊', '🍋', '🍌', '🍍', '🥭', '🍎', '🍐',
      '🍑', '🍒', '🍓', '🫐', '🥝', '🥥', '🌴', '🏝️', '🌺', '🌿',
      '🌱', '🔥', '⛩️', '🐃', '🦙', '☘️',
    ],
  },
  {
    label: 'Flags',
    emojis: [
      '🇺🇸', '🇲🇽', '🇨🇦', '🇧🇷', '🇦🇷', '🇵🇪', '🇨🇺', '🇯🇲', '🇮🇹', '🇫🇷',
      '🇪🇸', '🇵🇹', '🇬🇷', '🇩🇪', '🇬🇧', '🇮🇪', '🇨🇳', '🇯🇵', '🇰🇷', '🇹🇭',
      '🇻🇳', '🇵🇭', '🇮🇩', '🇲🇾', '🇸🇬', '🇮🇳', '🇧🇩', '🇵🇰', '🇱🇰', '🇹🇷',
      '🇱🇧', '🇮🇷', '🇸🇦', '🇮🇱', '🇪🇬', '🇪🇹', '🇲🇦', '🇦🇺',
    ],
  },
]

export function getCuisineEmoji(name: string): string {
  return CUISINE_EMOJI[name] ?? FALLBACK_EMOJI
}

/**
 * Title-case a cuisine name: lowercase, then capitalize the first letter of
 * each space- or hyphen-separated segment ("tex-mex" → "Tex-Mex",
 * "middle eastern" → "Middle Eastern"). Acronyms degrade to title-case
 * ("bbq" → "Bbq") — acceptable because the combobox matches existing cuisines
 * case-insensitively, so you almost never reach the "create new" path for one.
 */
export function titleCase(input: string): string {
  return input
    .toLowerCase()
    .replace(/(^|[\s-])(\p{L})/gu, (_match, sep: string, ch: string) => sep + ch.toUpperCase())
}

export function getKnownCuisines(): readonly string[] {
  return Object.keys(CUISINE_EMOJI).sort()
}

/** Return cuisines from `incoming` that aren't in CUISINE_EMOJI yet. Used by migration script. */
export function findUnknownCuisines(incoming: readonly string[]): string[] {
  return Array.from(new Set(incoming)).filter((c) => !(c in CUISINE_EMOJI)).sort()
}
