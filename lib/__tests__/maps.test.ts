import { describe, expect, it } from 'vitest'
import { googleMapsUrl } from '../maps'

describe('googleMapsUrl', () => {
  it('builds the documented search-by-coordinates URL', () => {
    expect(googleMapsUrl(33.4255, -111.94)).toBe(
      'https://www.google.com/maps/search/?api=1&query=33.4255,-111.94'
    )
  })

  it('handles negative and integer coordinates', () => {
    expect(googleMapsUrl(-23.5, 45)).toBe(
      'https://www.google.com/maps/search/?api=1&query=-23.5,45'
    )
  })
})
