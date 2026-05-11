'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type AddressPick = {
  display_name: string
  latitude: number
  longitude: number
}

type NominatimResult = {
  display_name: string
  lat: string
  lon: string
}

const DEBOUNCE_MS = 300

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
  const [results, setResults] = useState<NominatimResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Mirror the `value` prop when the parent resets it externally.
  // Pattern from https://react.dev/reference/react/useState#storing-information-from-previous-renders.
  const [prevValue, setPrevValue] = useState(value)
  if (prevValue !== value) {
    setPrevValue(value)
    setQuery(value ?? '')
  }

  // Derive what to render — keeps the effect free of synchronous setState.
  const visibleResults = query.trim().length < 3 ? [] : results

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
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`, {
          signal: ac.signal,
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as NominatimResult[]
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
  }, [query])

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
          onFocus={() => setOpen(true)}
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
                  className={cn(
                    'cursor-pointer px-3 py-2 text-sm hover:bg-accent'
                  )}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    setQuery(r.display_name)
                    setOpen(false)
                    onPick({
                      display_name: r.display_name,
                      latitude: Number(r.lat),
                      longitude: Number(r.lon),
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
