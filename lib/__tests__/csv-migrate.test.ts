import { describe, expect, it } from 'vitest'
import {
  detectChain,
  mapOccasion,
  mapVegetarian,
  parseCuisines,
  splitCities,
  stripEmojis,
} from '../csv-migrate'

describe('stripEmojis', () => {
  it('removes Extended Pictographic chars', () => {
    expect(stripEmojis('Thai 🍝')).toBe('Thai')
    expect(stripEmojis('Mexican 🌮')).toBe('Mexican')
  })

  it('removes the variation selector U+FE0F', () => {
    // "Cafe ☕️" — the ️ is U+FE0F, which is not Extended_Pictographic
    expect(stripEmojis('Cafe ☕️')).toBe('Cafe')
  })

  it('preserves text without emojis', () => {
    expect(stripEmojis('Burger')).toBe('Burger')
  })

  it('trims whitespace', () => {
    expect(stripEmojis('  Burger  ')).toBe('Burger')
  })
})

describe('parseCuisines', () => {
  it('splits and strips emojis', () => {
    expect(parseCuisines('Italian 🍝, Pizza 🍕')).toEqual(['Italian', 'Pizza'])
  })

  it('deduplicates', () => {
    expect(parseCuisines('Thai 🍝, Thai')).toEqual(['Thai'])
  })

  it('returns empty for empty input', () => {
    expect(parseCuisines('')).toEqual([])
  })

  it('handles slash separators', () => {
    expect(parseCuisines('Italian / Pizza')).toEqual(['Italian', 'Pizza'])
  })
})

describe('mapOccasion', () => {
  it('maps legacy values to canonical enum', () => {
    expect(mapOccasion('Everyday 🥪')).toBe('Quick')
    expect(mapOccasion('Casual 🍔')).toBe('Casual')
    expect(mapOccasion('Nice-Casual 🍝')).toBe('Elevated')
    expect(mapOccasion('Upscale 🥩')).toBe('Fine Dine')
  })

  it('passes canonical values through', () => {
    expect(mapOccasion('Fine Dine')).toBe('Fine Dine')
    expect(mapOccasion('Quick')).toBe('Quick')
  })

  it('returns null for blank or unknown', () => {
    expect(mapOccasion('')).toBeNull()
    expect(mapOccasion('Mystery')).toBeNull()
  })
})

describe('mapVegetarian', () => {
  it('maps Yes/No to yes/no', () => {
    expect(mapVegetarian('Yes')).toBe('yes')
    expect(mapVegetarian('No')).toBe('no')
  })

  it('returns null for Not sure and blank', () => {
    expect(mapVegetarian('Not sure')).toBeNull()
    expect(mapVegetarian('')).toBeNull()
  })

  it('is case-insensitive', () => {
    expect(mapVegetarian('YES')).toBe('yes')
  })
})

describe('detectChain', () => {
  it('detects literal "Chain" in city', () => {
    expect(detectChain('Chain', 'Tempe')).toBe(true)
  })

  it('detects "Chain" mixed with other cities', () => {
    expect(detectChain('Chain, Phoenix', 'Midtown')).toBe(true)
  })

  it('detects "Chain" in locality', () => {
    expect(detectChain('', 'Chain, somewhere')).toBe(true)
  })

  it('returns false for plain city values', () => {
    expect(detectChain('Tempe', 'Mill Ave')).toBe(false)
  })
})

describe('splitCities', () => {
  it('drops the "Chain" token', () => {
    expect(splitCities('Chain, Phoenix, Tempe')).toEqual(['Phoenix', 'Tempe'])
  })

  it('returns empty when only Chain', () => {
    expect(splitCities('Chain')).toEqual([])
  })

  it('trims each entry', () => {
    expect(splitCities('Phoenix , Tempe')).toEqual(['Phoenix', 'Tempe'])
  })
})
