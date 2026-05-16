"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Loader2, RefreshCcw, Search } from "lucide-react";
import { useRef, useState } from "react";

export type AddressPick = {
  display_name: string;
  latitude: number;
  longitude: number;
  /** Locality parsed from the result, for auto-filling the City field. May be null. */
  city: string | null;
};

// Mirrors `GeocodeHit` from lib/geocode.ts (the shape /api/geocode returns).
type GeocodeRow = {
  display_name: string;
  latitude: number;
  longitude: number;
  city: string | null;
};

// Default search box: roughly the state of Arizona. `/api/geocode` searches
// inside the box first and only falls back to an unrestricted search if that
// finds nothing — so AZ places win, but a trip restaurant still resolves.
// Replaced with a tighter box around the user's actual location once
// geolocation resolves.
const ARIZONA_VIEWBOX = "-114.85,31.30,-109.00,37.05";

function boxAround(lat: number, lon: number): string {
  const d = 0.6; // ~50–65 km each way
  const f = (n: number) => n.toFixed(4);
  return `${f(lon - d)},${f(lat - d)},${f(lon + d)},${f(lat + d)}`;
}

export function AddressAutocomplete({
  value,
  onPick,
  placeholder = "Search address…",
}: {
  value: string | null;
  onPick: (pick: AddressPick | null) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState(value ?? "");
  const [results, setResults] = useState<GeocodeRow[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewbox, setViewbox] = useState<string>(ARIZONA_VIEWBOX);
  const abortRef = useRef<AbortController | null>(null);
  const askedLocation = useRef(false);

  // Mirror the `value` prop when the parent resets it externally.
  // Pattern from https://react.dev/reference/react/useState#storing-information-from-previous-renders.
  const [prevValue, setPrevValue] = useState(value);
  if (prevValue !== value) {
    setPrevValue(value);
    setQuery(value ?? "");
    setResults([]);
    setOpen(false);
  }

  function requestLocationOnce() {
    if (askedLocation.current) return;
    askedLocation.current = true;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setViewbox(boxAround(pos.coords.latitude, pos.coords.longitude)),
      () => {
        /* denied / unavailable / timed out — keep the Arizona fallback */
      },
      { timeout: 5000, maximumAge: 10 * 60 * 1000 },
    );
  }

  async function runSearch() {
    const q = query.trim();
    if (q.length < 3) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError(null);
    setOpen(true);
    try {
      const res = await fetch(
        `/api/geocode?q=${encodeURIComponent(q)}&viewbox=${encodeURIComponent(viewbox)}`,
        { signal: ac.signal },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as GeocodeRow[];
      setResults(data);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError("Couldn't load suggestions");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  const canSearch = query.trim().length >= 3;

  return (
    <div className="relative">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          value={query}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            // Results belong to the previous query — drop them until the user searches again.
            setResults([]);
            setError(null);
            setOpen(false);
            if (e.target.value.trim().length === 0) onPick(null);
          }}
          onFocus={requestLocationOnce}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void runSearch();
            }
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="pr-10 pl-9"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Search"
          disabled={!canSearch || loading}
          onMouseDown={(e) => {
            // Keep the input's blur-close from beating our click.
            e.preventDefault();
          }}
          onClick={() => void runSearch()}
          className="absolute top-1/2 right-1 -translate-y-1/2"
        >
          {loading ? <Loader2 className="animate-spin" /> : <RefreshCcw />}
        </Button>
      </div>
      {open && (results.length > 0 || error) ? (
        <div className="bg-popover absolute z-50 mt-1 w-full overflow-hidden rounded-md border shadow-md">
          {error ? (
            <div className="text-destructive px-3 py-2 text-xs">{error}</div>
          ) : (
            <ul role="listbox" className="max-h-72 overflow-y-auto">
              {results.map((r, i) => (
                <li
                  key={i}
                  role="option"
                  aria-selected={false}
                  className={cn("hover:bg-accent cursor-pointer px-3 py-2 text-sm")}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setQuery(r.display_name);
                    setOpen(false);
                    onPick({
                      display_name: r.display_name,
                      latitude: r.latitude,
                      longitude: r.longitude,
                      city: r.city ?? null,
                    });
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
  );
}
