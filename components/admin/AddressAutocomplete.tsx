'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type AddressPick = {
  display_name: string
  latitude: number
  longitude: number
  /** Locality parsed from the result, for auto-filling the City field. May be null. */
  city: string | null
}

// Mirrors `GeocodeHit` from lib/geocode.ts (the shape /api/geocode returns).
type GeocodeRow = {
  display_name: string
  latitude: number
  longitude: number
  city: string | null
}

const DEBOUNCE_MS = 300

// Default search box: roughly the state of Arizona. `/api/geocode` searches
// inside the box first and only falls back to an unrestricted search if that
// finds nothing — so AZ places win, but a trip restaurant still resolves.
// Replaced with a tighter box around the user's actual location once
// geolocation resolves.
const ARIZONA_VIEWBOX = '-114.85,31.30,-109.00,37.05'

function boxAround(lat: number, lon: number): string {
  const d = 0.6 // ~50–65 km each way
  const f = (n: number) => n.toFixed(4)
  return `${f(lon - d)},${f(lat - d)},${f(lon + d)},${f(lat + d)}`
}

export function AddressAutocomplete({
  value,
  onPick,
  placeholder = 'Search address…',
}: {
  value: string | null
  onPick: (pick: AddressPick | null) => void
  placeholder?: string
}) {
  const [query, setQuery] = useState(value ?? '')
  const [results, setResults] = useState<GeocodeRow[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewbox, setViewbox] = useState<string>(ARIZONA_VIEWBOX)
  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const askedLocation = useRef(false)

  // Mirror the `value` prop when the parent resets it externally.
  // Pattern from https://react.dev/reference/react/useState#storing-information-from-previous-renders.
  const [prevValue, setPrevValue] = useState(value)
  if (prevValue !== value) {
    setPrevValue(value)
    setQuery(value ?? '')
  }

  // Derive what to render — keeps the effect free of synchronous setState.
  const visibleResults = query.trim().length < 3 ? [] : results

  function requestLocationOnce() {
    if (askedLocation.current) return
    askedLocation.current = true
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => setViewbox(boxAround(pos.coords.latitude, pos.coords.longitude)),
      () => {
        /* denied / unavailable / timed out — keep the Arizona fallback */
      },
      { timeout: 5000, maximumAge: 10 * 60 * 1000 },
    )
  }

  useEffect(() => {
    if (query.trim().length < 3) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `/api/geocode?q=${encodeURIComponent(query.trim())}&viewbox=${encodeURIComponent(viewbox)}`,
          { signal: ac.signal },
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as GeocodeRow[]
        setResults(data)
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setError("Couldn't load suggestions")
        setResults([])
      } finally {
        setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [query, viewbox])

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            if (e.target.value.trim().length === 0) onPick(null)
          }}
          onFocus={() => {
            setOpen(true)
            requestLocationOnce()
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="pl-9"
        />
        {loading ? (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : null}
      </div>
      {open && (visibleResults.length > 0 || error) ? (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-md">
          {error ? (
            <div className="px-3 py-2 text-xs text-destructive">{error}</div>
          ) : (
            <ul role="listbox" className="max-h-72 overflow-y-auto">
              {visibleResults.map((r, i) => (
                <li
                  key={i}
                  role="option"
                  aria-selected={false}
                  className={cn('cursor-pointer px-3 py-2 text-sm hover:bg-accent')}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    setQuery(r.display_name)
                    setOpen(false)
                    onPick({
                      display_name: r.display_name,
                      latitude: r.latitude,
                      longitude: r.longitude,
                      city: r.city ?? null,
                    })
                  }}
                >
                  {r.display_name}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
