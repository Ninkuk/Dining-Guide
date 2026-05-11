// Pure helpers used by scripts/migrate-csv.ts. Lifted here so they can be
// unit-tested without importing the script (which pulls in fs / dotenv etc).

export function stripEmojis(s: string): string {
  // \p{Extended_Pictographic} doesn't include the variation-selector (U+FE0F)
  // or zero-width-joiner (U+200D) that combine with base chars to render as
  // emoji. Strip those too, or "Cafe ☕️" leaves a dangling "️" on the name.
  return s
    .replace(/[\p{Extended_Pictographic}‍️]/gu, '')
    .trim()
}

export function parseCuisines(raw: string): string[] {
  if (!raw) return []
  return Array.from(
    new Set(
      raw
        .split(/[,/]/)
        .map((c) => stripEmojis(c))
        .map((c) => c.trim())
        .filter(Boolean)
    )
  )
}

export function mapOccasion(raw: string): string | null {
  const v = stripEmojis(raw)
  if (!v) return null
  switch (v) {
    case 'Everyday':
      return 'Quick'
    case 'Casual':
      return 'Casual'
    case 'Nice-Casual':
      return 'Elevated'
    case 'Upscale':
      return 'Fine Dine'
    case 'Quick':
    case 'Elevated':
    case 'Fine Dine':
      return v
    default:
      return null
  }
}

export function mapVegetarian(raw: string): string | null {
  const v = raw.trim().toLowerCase()
  if (v === 'yes') return 'yes'
  if (v === 'no') return 'no'
  return null
}

export function detectChain(city: string, locality: string): boolean {
  const tokens = [...city.split(','), ...locality.split(',')].map((t) => t.trim())
  return tokens.some((t) => t.toLowerCase() === 'chain')
}

export function splitCities(city: string): string[] {
  return city
    .split(',')
    .map((c) => c.trim())
    .filter((c) => c && c.toLowerCase() !== 'chain')
}
