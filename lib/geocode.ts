// Low-level Nominatim wrapper with a 1.1s per-instance queue.
//
// Used by:
//   - `app/api/geocode/route.ts` (the proxy serving the address-autocomplete UI)
//   - `scripts/migrate-csv.ts` (one-time bulk import; calls Nominatim directly
//     because the app may not be deployed yet)
//
// OpenStreetMap's usage policy mandates ≤1 request/second per identifiable
// caller and a descriptive User-Agent. We enforce 1.1s to give ourselves slack
// against clock drift; the User-Agent comes from NOMINATIM_USER_AGENT (server-
// only env var — never NEXT_PUBLIC_).

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org'
const MIN_INTERVAL_MS = 1100

export type NominatimResult = {
  lat: string
  lon: string
  display_name: string
  // Other fields exist on the wire but we only consume these three.
  [key: string]: unknown
}

export type GeocodeHit = {
  latitude: number
  longitude: number
  display_name: string
}

class RateLimitedQueue {
  private last = 0
  private chain: Promise<unknown> = Promise.resolve()

  enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      const now = Date.now()
      const wait = Math.max(0, this.last + MIN_INTERVAL_MS - now)
      if (wait > 0) await new Promise((r) => setTimeout(r, wait))
      this.last = Date.now()
      return fn()
    }
    const next = this.chain.then(run, run)
    // Keep the chain alive even if a task throws.
    this.chain = next.catch(() => undefined)
    return next
  }
}

const queue = new RateLimitedQueue()

function userAgent(): string {
  const ua = process.env.NOMINATIM_USER_AGENT
  if (!ua) {
    throw new Error('NOMINATIM_USER_AGENT is not set')
  }
  return ua
}

/**
 * Forward-geocode a free-text query. Returns the first hit or null.
 */
export async function geocodeSearch(query: string): Promise<GeocodeHit | null> {
  const trimmed = query.trim()
  if (trimmed.length === 0) return null

  return queue.enqueue(async () => {
    const url = new URL('/search', NOMINATIM_BASE)
    url.searchParams.set('q', trimmed)
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('limit', '1')
    url.searchParams.set('addressdetails', '0')

    const res = await fetch(url, {
      headers: {
        'User-Agent': userAgent(),
        Accept: 'application/json',
      },
    })
    if (!res.ok) {
      throw new Error(`Nominatim ${res.status}: ${await res.text().catch(() => '')}`)
    }
    const data = (await res.json()) as NominatimResult[]
    if (!data.length) return null
    const hit = data[0]
    return {
      latitude: Number(hit.lat),
      longitude: Number(hit.lon),
      display_name: hit.display_name,
    }
  })
}

/**
 * Autocomplete: return up to `limit` hits. Used by the AddressAutocomplete combobox.
 */
export async function geocodeAutocomplete(
  query: string,
  limit = 5
): Promise<NominatimResult[]> {
  const trimmed = query.trim()
  if (trimmed.length < 3) return []

  return queue.enqueue(async () => {
    const url = new URL('/search', NOMINATIM_BASE)
    url.searchParams.set('q', trimmed)
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('limit', String(limit))
    url.searchParams.set('addressdetails', '0')

    const res = await fetch(url, {
      headers: {
        'User-Agent': userAgent(),
        Accept: 'application/json',
      },
    })
    if (!res.ok) {
      throw new Error(`Nominatim ${res.status}: ${await res.text().catch(() => '')}`)
    }
    return (await res.json()) as NominatimResult[]
  })
}
