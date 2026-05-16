// Server-side geocode proxy (Photon, via lib/geocode.ts).
//
// The browser hits this route from the address-autocomplete combobox. The
// route exists to (a) keep all geocoding behind one server module and (b) cache
// responses for 7 days in an in-memory map. Returns `GeocodeHit[]` (see
// lib/geocode.ts): `{ latitude, longitude, display_name }`.
//
// Fluid Compute reuses function instances, so the cache survives between
// invocations on the same instance — good enough for a single-admin app.

import { NextResponse } from "next/server";
import { geocodeAutocomplete } from "@/lib/geocode";

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

type CacheEntry = { ts: number; value: unknown };
const cache = new Map<string, CacheEntry>();

function read(key: string): unknown | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function write(key: string, value: unknown): void {
  cache.set(key, { ts: Date.now(), value });
}

/** Accept a `minLon,minLat,maxLon,maxLat` viewbox; ignore anything malformed. */
function parseViewbox(raw: string | null): string | undefined {
  if (!raw) return undefined;
  const parts = raw.split(",");
  if (parts.length !== 4) return undefined;
  if (parts.some((p) => !Number.isFinite(Number(p)))) return undefined;
  return raw;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  if (!q || q.length < 3) {
    return NextResponse.json([], { status: 200 });
  }

  const viewbox = parseViewbox(url.searchParams.get("viewbox"));
  const key = `${q.toLowerCase()}|${viewbox ?? ""}`;
  const cached = read(key);
  if (cached) {
    return NextResponse.json(cached, { headers: { "x-cache": "hit" } });
  }

  try {
    const results = await geocodeAutocomplete(q, 5, viewbox);
    write(key, results);
    return NextResponse.json(results, { headers: { "x-cache": "miss" } });
  } catch (err) {
    console.error("geocode proxy failed:", err);
    return NextResponse.json({ error: "Geocode lookup failed" }, { status: 502 });
  }
}
