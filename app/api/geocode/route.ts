// Server-side Nominatim proxy.
//
// Browser hits this route from the address-autocomplete combobox; this route
// adds the User-Agent header (server-only env var), enforces the 1.1s queue
// (lib/geocode.ts), and caches responses for 7 days in an in-memory map.
//
// Fluid Compute reuses function instances, so the cache survives between
// invocations on the same instance — good enough for a single-admin app.

import { NextResponse } from 'next/server'
import { geocodeAutocomplete } from '@/lib/geocode'

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

type CacheEntry = { ts: number; value: unknown }
const cache = new Map<string, CacheEntry>()

function read(key: string): unknown | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(key)
    return null
  }
  return entry.value
}

function write(key: string, value: unknown): void {
  cache.set(key, { ts: Date.now(), value })
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const q = url.searchParams.get('q')?.trim()
  if (!q || q.length < 3) {
    return NextResponse.json([], { status: 200 })
  }

  const key = q.toLowerCase()
  const cached = read(key)
  if (cached) {
    return NextResponse.json(cached, { headers: { 'x-cache': 'hit' } })
  }

  try {
    const results = await geocodeAutocomplete(q, 5)
    write(key, results)
    return NextResponse.json(results, { headers: { 'x-cache': 'miss' } })
  } catch (err) {
    console.error('geocode proxy failed:', err)
    return NextResponse.json(
      { error: 'Geocode lookup failed' },
      { status: 502 }
    )
  }
}
