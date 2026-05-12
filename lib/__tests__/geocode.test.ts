import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatPhotonLabel, photonCity, centerOf, geocodeAutocomplete, geocodeSearch } from '../geocode'

// Shared helper — lifted to module scope so all describe blocks can use it.
function mockFetchSequence(...responses: Array<{ features: unknown[] }>) {
  let i = 0
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
    const body = responses[Math.min(i++, responses.length - 1)]
    return new Response(JSON.stringify(body), { status: 200 })
  })
}

describe('formatPhotonLabel', () => {
  it('joins name, street, locality, region, postcode, country', () => {
    expect(
      formatPhotonLabel({
        name: 'Pizzeria Bianco',
        housenumber: '623',
        street: 'E Adams St',
        district: 'Garfield',
        city: 'Phoenix',
        state: 'Arizona',
        postcode: '85004',
        country: 'United States',
      }),
    ).toBe('Pizzeria Bianco, 623 E Adams St, Garfield, Phoenix, Arizona, 85004, United States')
  })

  it('skips missing parts and never emits empty segments or doubled commas', () => {
    expect(formatPhotonLabel({ street: 'Mill Ave', city: 'Tempe', country: 'United States' })).toBe(
      'Mill Ave, Tempe, United States',
    )
  })

  it('drops a duplicate when name equals the street or city', () => {
    expect(formatPhotonLabel({ name: 'Tempe', city: 'Tempe', state: 'Arizona' })).toBe('Tempe, Arizona')
  })

  it('falls back to town/village/county when city is absent', () => {
    expect(formatPhotonLabel({ name: 'Cafe', village: 'Jerome', state: 'Arizona' })).toBe(
      'Cafe, Jerome, Arizona',
    )
  })

  it('returns an empty string when given nothing usable', () => {
    expect(formatPhotonLabel({})).toBe('')
  })

  it('coerces a numeric postcode via String()', () => {
    expect(formatPhotonLabel({ name: 'Bianco', city: 'Phoenix', postcode: 85004 })).toBe(
      'Bianco, Phoenix, 85004',
    )
  })
})

describe('photonCity', () => {
  it('returns city when present', () => {
    expect(photonCity({ city: 'Phoenix', county: 'Maricopa County', state: 'Arizona' })).toBe('Phoenix')
  })

  it('falls back to town then village', () => {
    expect(photonCity({ town: 'Payson' })).toBe('Payson')
    expect(photonCity({ village: 'Jerome' })).toBe('Jerome')
  })

  it('does not fall back to county', () => {
    expect(photonCity({ county: 'Maricopa County', state: 'Arizona' })).toBeNull()
  })

  it('returns null when nothing usable', () => {
    expect(photonCity({})).toBeNull()
    expect(photonCity({ city: '   ' })).toBeNull()
  })
})

describe('centerOf', () => {
  it('returns the midpoint of a "minLon,minLat,maxLon,maxLat" box', () => {
    expect(centerOf('-114.85,31.30,-109.00,37.05')).toEqual({ lon: -111.925, lat: 34.175 })
  })

  it('rejects malformed input', () => {
    expect(centerOf('not,a,box')).toBeNull()
    expect(centerOf('1,2,3')).toBeNull()
    expect(centerOf('1,2,3,nope')).toBeNull()
  })
})

describe('geocodeSearch', () => {
  afterEach(() => vi.restoreAllMocks())

  it('returns null for empty/whitespace queries without calling fetch', async () => {
    const f = mockFetchSequence({ features: [] })
    expect(await geocodeSearch('')).toBeNull()
    expect(await geocodeSearch('   ')).toBeNull()
    expect(f).not.toHaveBeenCalled()
  })

  it('returns the first hit mapped to a GeocodeHit', async () => {
    mockFetchSequence({
      features: [
        {
          geometry: { coordinates: [-111.94, 33.42] },
          properties: { name: 'Bianco', city: 'Phoenix', state: 'Arizona' },
        },
      ],
    })
    const result = await geocodeSearch('Bianco')
    expect(result).toEqual({
      latitude: 33.42,
      longitude: -111.94,
      display_name: 'Bianco, Phoenix, Arizona',
      city: 'Phoenix',
    })
  })

  it('returns null when the response has no features', async () => {
    mockFetchSequence({ features: [] })
    expect(await geocodeSearch('xyzzy')).toBeNull()
  })
})

describe('geocodeAutocomplete', () => {
  afterEach(() => vi.restoreAllMocks())

  it('returns [] for queries under 3 chars without calling fetch', async () => {
    const f = mockFetchSequence({ features: [] })
    expect(await geocodeAutocomplete('ab')).toEqual([])
    expect(f).not.toHaveBeenCalled()
  })

  it('uses bbox first when a viewbox is given and returns mapped hits', async () => {
    const f = mockFetchSequence({
      features: [
        {
          geometry: { coordinates: [-111.94, 33.42] },
          properties: { name: 'Bianco', city: 'Phoenix', state: 'Arizona' },
        },
      ],
    })
    const out = await geocodeAutocomplete('bianco', 5, '-114.85,31.30,-109.00,37.05')
    expect(out).toEqual([
      { latitude: 33.42, longitude: -111.94, display_name: 'Bianco, Phoenix, Arizona', city: 'Phoenix' },
    ])
    expect((f.mock.calls[0][0] as URL).searchParams.get('bbox')).toBe('-114.85,31.30,-109.00,37.05')
  })

  it('falls back to a lat/lon-biased search when the bbox search is empty', async () => {
    const f = mockFetchSequence(
      { features: [] },
      {
        features: [
          { geometry: { coordinates: [2.35, 48.85] }, properties: { name: 'Le Cinq', city: 'Paris', country: 'France' } },
        ],
      },
    )
    const out = await geocodeAutocomplete('le cinq', 5, '-114.85,31.30,-109.00,37.05')
    expect(out).toEqual([
      { latitude: 48.85, longitude: 2.35, display_name: 'Le Cinq, Paris, France', city: 'Paris' },
    ])
    expect(f).toHaveBeenCalledTimes(2)
    const second = f.mock.calls[1][0] as URL
    expect(second.searchParams.has('bbox')).toBe(false)
    expect(second.searchParams.get('lat')).toBe('34.175')
    expect(second.searchParams.get('lon')).toBe('-111.925')
  })

  it('searches without bbox/lat/lon params when no viewbox is given', async () => {
    const f = mockFetchSequence({
      features: [
        {
          geometry: { coordinates: [-111.94, 33.42] },
          properties: { name: 'Bianco', city: 'Phoenix', state: 'Arizona' },
        },
      ],
    })
    const out = await geocodeAutocomplete('bianco')
    expect(out).toEqual([
      { latitude: 33.42, longitude: -111.94, display_name: 'Bianco, Phoenix, Arizona', city: 'Phoenix' },
    ])
    expect(f).toHaveBeenCalledTimes(1)
    const url = f.mock.calls[0][0] as URL
    expect(url.searchParams.has('bbox')).toBe(false)
    expect(url.searchParams.has('lat')).toBe(false)
    expect(url.searchParams.has('lon')).toBe(false)
    expect(url.searchParams.get('q')).toBe('bianco')
    expect(url.searchParams.get('lang')).toBe('en')
    expect(url.searchParams.get('limit')).toBe('5')
  })
})
