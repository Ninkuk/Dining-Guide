import { describe, expect, it } from 'vitest'
import {
  CUISINE_EMOJI,
  findUnknownCuisines,
  getCuisineEmoji,
  getKnownCuisines,
} from '../cuisines'

describe('CUISINE_EMOJI', () => {
  it('contains a few well-known cuisines', () => {
    expect(CUISINE_EMOJI.Pizza).toBeDefined()
    expect(CUISINE_EMOJI.Italian).toBeDefined()
    expect(CUISINE_EMOJI.Mexican).toBeDefined()
  })

  it('every entry is a non-empty string', () => {
    for (const [name, emoji] of Object.entries(CUISINE_EMOJI)) {
      expect(name.length, `${name} key`).toBeGreaterThan(0)
      expect(emoji.length, `${name} emoji`).toBeGreaterThan(0)
    }
  })
})

describe('getCuisineEmoji', () => {
  it('returns the mapped emoji for known names', () => {
    expect(getCuisineEmoji('Pizza')).toBe(CUISINE_EMOJI.Pizza)
  })

  it('falls back to 🍽️ for unknown names', () => {
    expect(getCuisineEmoji('Klingon')).toBe('🍽️')
  })

  it('is case-sensitive (matches the canonical DB form)', () => {
    expect(getCuisineEmoji('pizza')).toBe('🍽️')
    expect(getCuisineEmoji('Pizza')).not.toBe('🍽️')
  })
})

describe('findUnknownCuisines', () => {
  it('returns deduped, sorted list of cuisines not in the map', () => {
    expect(findUnknownCuisines(['Pizza', 'Klingon', 'Pizza', 'Vulcan'])).toEqual([
      'Klingon',
      'Vulcan',
    ])
  })

  it('returns empty when all are known', () => {
    expect(findUnknownCuisines(['Pizza', 'Italian'])).toEqual([])
  })
})

describe('getKnownCuisines', () => {
  it('returns the keys of CUISINE_EMOJI sorted alphabetically', () => {
    const sorted = [...Object.keys(CUISINE_EMOJI)].sort()
    expect(getKnownCuisines()).toEqual(sorted)
  })
})
