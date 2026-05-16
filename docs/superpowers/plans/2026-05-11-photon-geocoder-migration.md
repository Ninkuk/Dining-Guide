# Photon Geocoder Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Nominatim (OpenStreetMap) backend behind the admin address autocomplete with Photon (komoot's OSM-based search engine), which is built for type-as-you-go autocomplete — better prefix matching, typo tolerance, and no 1-request-per-second policy.

**Architecture:** `lib/geocode.ts` is the single chokepoint for all geocoding. It currently wraps `nominatim.openstreetmap.org/search` behind a 1.1s rate-limited queue and a server-only `NOMINATIM_USER_AGENT` header. We swap the HTTP layer to `photon.komoot.io/api/` (GeoJSON `FeatureCollection` responses, no key, no user-agent requirement), keep the rate-limited queue but loosen it to 250ms (politeness for the one-time bulk CSV import), keep `geocodeSearch`'s `GeocodeHit` shape unchanged so its two callers don't move, and change `geocodeAutocomplete` to also return `GeocodeHit[]` (numbers, with a composed `display_name`) instead of the old `NominatimResult[]` (lat/lon strings). That return-type change ripples into `app/api/geocode/route.ts` (pass-through, no code change beyond a comment) and `components/admin/AddressAutocomplete.tsx` (rename the row type, read `latitude`/`longitude` instead of `Number(r.lat)`). The Arizona-viewbox + geolocation-bias UX in `AddressAutocomplete` is untouched — Photon takes the same `minLon,minLat,maxLon,maxLat` string as its `bbox` param.

**Tech Stack:** Next.js (App Router, route handler), TypeScript, Vitest, `fetch`. Photon HTTP API (`https://photon.komoot.io/api/`).

> **Do not commit.** This repo's owner reviews and commits changes themselves. After each task, run the verification commands, leave the working tree dirty, and stop for review — do **not** `git add` / `git commit` even though the executing-plans workflow normally would. Wait for the owner to ask before committing anything.

---

## Photon API reference (read before Task 1)

- **Endpoint:** `GET https://photon.komoot.io/api/?q=<text>&limit=<n>&lang=en`
- **Location bias (soft — reranks toward a point):** `&lat=<lat>&lon=<lon>`
- **Bounding box (hard — restricts results to the box):** `&bbox=<minLon>,<minLat>,<maxLon>,<maxLat>` — same component order our app already uses for the Nominatim `viewbox`.
- **Response shape:** GeoJSON `FeatureCollection`:

  ```json
  {
    "type": "FeatureCollection",
    "features": [
      {
        "geometry": { "type": "Point", "coordinates": [-111.927, 33.428] },
        "properties": {
          "name": "Pizzeria Bianco",
          "housenumber": "623",
          "street": "E Adams St",
          "district": "Garfield",
          "city": "Phoenix",
          "county": "Maricopa County",
          "state": "Arizona",
          "postcode": "85004",
          "country": "United States",
          "countrycode": "US",
          "osm_key": "amenity",
          "osm_value": "restaurant",
          "type": "house"
        }
      }
    ]
  }
  ```

  Notes: `coordinates` is `[lon, lat]` (GeoJSON order — easy to get backwards). Photon does **not** return a pre-joined `display_name`; we compose one from the structured properties. Any property may be absent. City may surface as `city`, `town`, or `village` depending on the place. No API key, no `User-Agent` requirement; usage policy asks for "reasonable" use and discourages heavy bulk geocoding (hence we keep a gentle queue for the migration script).

---

## File Structure

- **Modify** `lib/geocode.ts` — full rewrite of the HTTP layer; new `formatPhotonLabel` + `centerOf` helpers (exported for testing); `geocodeSearch` keeps its `GeocodeHit | null` signature; `geocodeAutocomplete` now returns `GeocodeHit[]`. Queue stays, interval drops 1100 → 250ms. Drops the `NOMINATIM_USER_AGENT` requirement.
- **Create** `lib/__tests__/geocode.test.ts` — unit tests for `formatPhotonLabel`, `centerOf`, and `geocodeAutocomplete`'s bbox→bias fallback (the only place worth a `fetch` mock).
- **Modify** `app/api/geocode/route.ts` — no logic change; update the header comment (no more 1.1s queue / user-agent) and the cached value's implicit type is now `GeocodeHit[]`.
- **Modify** `components/admin/AddressAutocomplete.tsx` — rename `NominatimResult` → `GeocodeRow` with `{ display_name; latitude; longitude }`; in the result-click handler read `r.latitude` / `r.longitude` directly (drop the `Number(...)` casts). The viewbox/geolocation logic is unchanged.
- **Modify** `.env.example` — remove the `NOMINATIM_USER_AGENT=...` line.
- **Verify only (expect no edits)** `app/(admin)/_actions/restaurants.ts`, `scripts/migrate-csv.ts` — both consume `geocodeSearch`'s unchanged `GeocodeHit`. Update the stale `"Geocoding (1.1s between calls)…"` log string in `migrate-csv.ts` to `"…(0.25s between calls)…"`.

---

### Task 1: Rewrite `lib/geocode.ts` to use Photon

**Files:**

- Modify: `lib/geocode.ts` (full rewrite)
- Test: `lib/__tests__/geocode.test.ts` (new)

- [ ] **Step 1: Write the failing tests**

Create `lib/__tests__/geocode.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatPhotonLabel, centerOf, geocodeAutocomplete } from "../geocode";

describe("formatPhotonLabel", () => {
  it("joins name, street, locality, region, postcode, country", () => {
    expect(
      formatPhotonLabel({
        name: "Pizzeria Bianco",
        housenumber: "623",
        street: "E Adams St",
        district: "Garfield",
        city: "Phoenix",
        state: "Arizona",
        postcode: "85004",
        country: "United States",
      }),
    ).toBe("Pizzeria Bianco, 623 E Adams St, Garfield, Phoenix, Arizona, 85004, United States");
  });

  it("skips missing parts and never emits empty segments or doubled commas", () => {
    expect(
      formatPhotonLabel({
        street: "Mill Ave",
        city: "Tempe",
        country: "United States",
      }),
    ).toBe("Mill Ave, Tempe, United States");
  });

  it("drops a duplicate when name equals the street or city", () => {
    expect(formatPhotonLabel({ name: "Tempe", city: "Tempe", state: "Arizona" })).toBe(
      "Tempe, Arizona",
    );
  });

  it("falls back to town/village/county when city is absent", () => {
    expect(formatPhotonLabel({ name: "Cafe", village: "Jerome", state: "Arizona" })).toBe(
      "Cafe, Jerome, Arizona",
    );
  });

  it("returns an empty string when given nothing usable", () => {
    expect(formatPhotonLabel({})).toBe("");
  });
});

describe("centerOf", () => {
  it('returns the midpoint of a "minLon,minLat,maxLon,maxLat" box', () => {
    expect(centerOf("-114.85,31.30,-109.00,37.05")).toEqual({
      lon: -111.925,
      lat: 34.175,
    });
  });

  it("rejects malformed input", () => {
    expect(centerOf("not,a,box")).toBeNull();
    expect(centerOf("1,2,3")).toBeNull();
    expect(centerOf("1,2,3,nope")).toBeNull();
  });
});

describe("geocodeAutocomplete", () => {
  afterEach(() => vi.restoreAllMocks());

  function mockFetchSequence(...responses: Array<{ features: unknown[] }>) {
    let i = 0;
    return vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      const body = responses[Math.min(i++, responses.length - 1)];
      return new Response(JSON.stringify(body), { status: 200 });
    });
  }

  it("returns [] for queries under 3 chars without calling fetch", async () => {
    const f = mockFetchSequence({ features: [] });
    expect(await geocodeAutocomplete("ab")).toEqual([]);
    expect(f).not.toHaveBeenCalled();
  });

  it("uses bbox first when a viewbox is given and returns mapped hits", async () => {
    const f = mockFetchSequence({
      features: [
        {
          geometry: { coordinates: [-111.94, 33.42] },
          properties: { name: "Bianco", city: "Phoenix", state: "Arizona" },
        },
      ],
    });
    const out = await geocodeAutocomplete("bianco", 5, "-114.85,31.30,-109.00,37.05");
    expect(out).toEqual([
      {
        latitude: 33.42,
        longitude: -111.94,
        display_name: "Bianco, Phoenix, Arizona",
      },
    ]);
    expect((f.mock.calls[0][0] as URL).searchParams.get("bbox")).toBe(
      "-114.85,31.30,-109.00,37.05",
    );
  });

  it("falls back to a lat/lon-biased search when the bbox search is empty", async () => {
    const f = mockFetchSequence(
      { features: [] },
      {
        features: [
          {
            geometry: { coordinates: [2.35, 48.85] },
            properties: { name: "Le Cinq", city: "Paris", country: "France" },
          },
        ],
      },
    );
    const out = await geocodeAutocomplete("le cinq", 5, "-114.85,31.30,-109.00,37.05");
    expect(out).toEqual([
      {
        latitude: 48.85,
        longitude: 2.35,
        display_name: "Le Cinq, Paris, France",
      },
    ]);
    expect(f).toHaveBeenCalledTimes(2);
    const second = f.mock.calls[1][0] as URL;
    expect(second.searchParams.has("bbox")).toBe(false);
    expect(second.searchParams.get("lat")).toBe("34.175");
    expect(second.searchParams.get("lon")).toBe("-111.925");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/__tests__/geocode.test.ts`
Expected: FAIL — `formatPhotonLabel`, `centerOf` are not exported by `../geocode` (import error / "is not a function").

- [ ] **Step 3: Rewrite `lib/geocode.ts`**

Replace the **entire contents** of `lib/geocode.ts` with:

```ts
// Photon (komoot) geocoder + autocomplete wrapper.
//
// Photon is an OSM-based search engine purpose-built for type-as-you-go
// autocomplete: https://photon.komoot.io / https://github.com/komoot/photon.
// No API key, no User-Agent requirement. The public instance asks for
// "reasonable" use and discourages heavy bulk geocoding, so we keep a small
// per-instance queue (250ms) — harmless for the interactive combobox (which
// already debounces 300ms) and polite for the one-time CSV import.
//
// Used by:
//   - `app/api/geocode/route.ts` (the proxy serving the address-autocomplete UI)
//   - `app/(admin)/_actions/restaurants.ts` (server-side safety-net geocode)
//   - `scripts/migrate-csv.ts` (one-time bulk import)

const PHOTON_BASE = "https://photon.komoot.io/api/";
const MIN_INTERVAL_MS = 250;

export type GeocodeHit = {
  latitude: number;
  longitude: number;
  display_name: string;
};

type PhotonProperties = Record<string, string | number | undefined>;
type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: PhotonProperties;
};

class RateLimitedQueue {
  private last = 0;
  private chain: Promise<unknown> = Promise.resolve();

  enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      const wait = Math.max(0, this.last + MIN_INTERVAL_MS - Date.now());
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      this.last = Date.now();
      return fn();
    };
    const next = this.chain.then(run, run);
    this.chain = next.catch(() => undefined); // keep the chain alive past a throw
    return next;
  }
}

const queue = new RateLimitedQueue();

/** Build a human-readable address line from Photon's structured properties. */
export function formatPhotonLabel(p: PhotonProperties): string {
  const street = [p.housenumber, p.street].filter(Boolean).join(" ");
  const locality = p.city ?? p.town ?? p.village ?? p.county;
  const parts = [p.name, street, p.district, locality, p.state, p.postcode, p.country];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const s = String(part ?? "").trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out.join(", ");
}

/** Midpoint of a `minLon,minLat,maxLon,maxLat` box, or null if malformed. */
export function centerOf(viewbox: string): { lat: number; lon: number } | null {
  const n = viewbox.split(",").map(Number);
  if (n.length !== 4 || n.some((v) => !Number.isFinite(v))) return null;
  return { lon: (n[0] + n[2]) / 2, lat: (n[1] + n[3]) / 2 };
}

function toHit(f: PhotonFeature): GeocodeHit {
  const [lon, lat] = f.geometry.coordinates; // GeoJSON order: [lon, lat]
  return {
    latitude: lat,
    longitude: lon,
    display_name: formatPhotonLabel(f.properties),
  };
}

type PhotonOpts = {
  limit: number;
  bias?: { lat: number; lon: number };
  bbox?: string;
};

function photon(q: string, opts: PhotonOpts): Promise<PhotonFeature[]> {
  return queue.enqueue(async () => {
    const url = new URL(PHOTON_BASE);
    url.searchParams.set("q", q);
    url.searchParams.set("lang", "en");
    url.searchParams.set("limit", String(opts.limit));
    if (opts.bias) {
      url.searchParams.set("lat", String(opts.bias.lat));
      url.searchParams.set("lon", String(opts.bias.lon));
    }
    if (opts.bbox) url.searchParams.set("bbox", opts.bbox);

    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      throw new Error(`Photon ${res.status}: ${await res.text().catch(() => "")}`);
    }
    const data = (await res.json()) as { features?: PhotonFeature[] };
    return data.features ?? [];
  });
}

/** Forward-geocode a free-text query. Returns the first hit or null. */
export async function geocodeSearch(query: string): Promise<GeocodeHit | null> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return null;
  const features = await photon(trimmed, { limit: 1 });
  return features.length ? toHit(features[0]) : null;
}

/**
 * Autocomplete: up to `limit` hits. Used by the AddressAutocomplete combobox.
 *
 * `viewbox` is a `minLon,minLat,maxLon,maxLat` string. We first search
 * restricted to that box (Photon `bbox=`); if it finds nothing — e.g. a
 * restaurant from a trip, typed from home — we retry unbounded but biased
 * toward the box's centre, so the query still resolves.
 */
export async function geocodeAutocomplete(
  query: string,
  limit = 5,
  viewbox?: string,
): Promise<GeocodeHit[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  if (viewbox) {
    const local = await photon(trimmed, { limit, bbox: viewbox });
    if (local.length > 0) return local.map(toHit);
    const bias = centerOf(viewbox);
    if (bias) return (await photon(trimmed, { limit, bias })).map(toHit);
  }
  return (await photon(trimmed, { limit })).map(toHit);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/__tests__/geocode.test.ts`
Expected: PASS — all cases green.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS. (If it complains about `app/api/geocode/route.ts` or `components/admin/AddressAutocomplete.tsx`, that's expected — those are fixed in Tasks 2–3. If it complains about `restaurants.ts` or `migrate-csv.ts`, stop: `GeocodeHit` shape must have drifted — recheck Step 3.)

- [ ] **Step 6: Stop for review**

Leave the changes uncommitted. Summarise what changed (`lib/geocode.ts` rewritten, `lib/__tests__/geocode.test.ts` added) and that tests + typecheck pass, then wait for the owner. Do not `git commit`.

---

### Task 2: Update the `/api/geocode` proxy for the new return type

**Files:**

- Modify: `app/api/geocode/route.ts`

- [ ] **Step 1: Update the header comment and cache typing note**

In `app/api/geocode/route.ts`, replace the top comment block:

```ts
// Server-side Nominatim proxy.
//
// Browser hits this route from the address-autocomplete combobox; this route
// adds the User-Agent header (server-only env var), enforces the 1.1s queue
// (lib/geocode.ts), and caches responses for 7 days in an in-memory map.
//
// Fluid Compute reuses function instances, so the cache survives between
// invocations on the same instance — good enough for a single-admin app.
```

with:

```ts
// Server-side geocode proxy (Photon, via lib/geocode.ts).
//
// The browser hits this route from the address-autocomplete combobox. The
// route exists to (a) keep all geocoding behind one server module and (b) cache
// responses for 7 days in an in-memory map. Returns `GeocodeHit[]` (see
// lib/geocode.ts): `{ latitude, longitude, display_name }`.
//
// Fluid Compute reuses function instances, so the cache survives between
// invocations on the same instance — good enough for a single-admin app.
```

No other changes: `geocodeAutocomplete(q, 5, viewbox)` already returns the new shape, and the route just JSON-stringifies it.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: still only complains (if at all) about `components/admin/AddressAutocomplete.tsx` — fixed next.

- [ ] **Step 3: Stop for review**

Leave the change uncommitted; note the comment refresh and that typecheck still passes. Do not `git commit`.

---

### Task 3: Update `AddressAutocomplete` for the new wire shape

**Files:**

- Modify: `components/admin/AddressAutocomplete.tsx`

- [ ] **Step 1: Rename the row type**

In `components/admin/AddressAutocomplete.tsx`, replace:

```ts
type NominatimResult = {
  display_name: string;
  lat: string;
  lon: string;
};
```

with:

```ts
// Mirrors `GeocodeHit` from lib/geocode.ts (the shape /api/geocode returns).
type GeocodeRow = {
  display_name: string;
  latitude: number;
  longitude: number;
};
```

- [ ] **Step 2: Update the two `useState`/`useRef`-adjacent references**

Replace:

```ts
const [results, setResults] = useState<NominatimResult[]>([]);
```

with:

```ts
const [results, setResults] = useState<GeocodeRow[]>([]);
```

And in the fetch handler replace:

```ts
const data = (await res.json()) as NominatimResult[];
setResults(data);
```

with:

```ts
const data = (await res.json()) as GeocodeRow[];
setResults(data);
```

- [ ] **Step 3: Update the result-click handler to read numbers directly**

Replace the `onMouseDown` body inside the `visibleResults.map(...)`:

```ts
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
```

with:

```ts
                  onMouseDown={(e) => {
                    e.preventDefault()
                    setQuery(r.display_name)
                    setOpen(false)
                    onPick({
                      display_name: r.display_name,
                      latitude: r.latitude,
                      longitude: r.longitude,
                    })
                  }}
```

(The `AddressPick` exported type, the `ARIZONA_VIEWBOX` constant, `boxAround`, the geolocation logic, and the `viewbox` query param all stay exactly as they are — Photon accepts the same `minLon,minLat,maxLon,maxLat` string.)

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit && npx next lint`
Expected: PASS, no errors.

- [ ] **Step 5: Stop for review**

Leave the change uncommitted; note that typecheck + lint pass. Do not `git commit`.

---

### Task 4: Drop the obsolete `NOMINATIM_USER_AGENT` env var and stale log string

**Files:**

- Modify: `.env.example`
- Modify: `scripts/migrate-csv.ts` (one log line; verify no other changes needed)
- Verify: `app/(admin)/_actions/restaurants.ts` (expect no edits)

- [ ] **Step 1: Remove the env var from `.env.example`**

Delete this line from `.env.example`:

```
NOMINATIM_USER_AGENT=...
```

(Also remove it from your local `.env.local` if present — it's now unused. Photon needs no key or user-agent.)

- [ ] **Step 2: Fix the stale "1.1s" log string in `migrate-csv.ts`**

In `scripts/migrate-csv.ts`, find:

```ts
console.log(`\nGeocoding (1.1s between calls)…`);
```

Replace with:

```ts
console.log(`\nGeocoding (~0.25s between calls)…`);
```

Confirm nothing else in `migrate-csv.ts` references Nominatim or `NOMINATIM_USER_AGENT` (it shouldn't — it only imports `geocodeSearch`, whose `GeocodeHit` return shape is unchanged).

- [ ] **Step 3: Verify the server action still typechecks untouched**

Open `app/(admin)/_actions/restaurants.ts` and confirm `fillMissingGeocodes` still reads `hit.latitude`, `hit.longitude`, `hit.display_name` — all still present on `GeocodeHit`. No edit expected.

- [ ] **Step 4: Full verification run**

Run: `npx tsc --noEmit && npx next lint && npm test`
Expected: typecheck clean, lint clean, all Vitest suites pass (including the new `lib/__tests__/geocode.test.ts`).

- [ ] **Step 5: Stop for review**

Leave everything uncommitted. The migration's code changes are now complete and verified — present a summary of all touched files and the green test/typecheck/lint run, and wait for the owner to commit. Do not `git commit`.

---

### Task 5: Manual smoke test

**Files:** none (verification only).

- [ ] **Step 1: Run the dev server**

Run: `npm run dev`

- [ ] **Step 2: Exercise the autocomplete in the admin form**

In a browser, go to the admin "Add restaurant" page, focus an address field in a location row, and type a partial AZ query (e.g. `pizzeria bia`). Confirm:

- Suggestions appear within ~1s and update as you keep typing (prefix matching now works mid-word).
- Picking a suggestion fills the address text and (check via the form state / a subsequent save) sets numeric `latitude`/`longitude`.
- Type a partial out-of-state query (e.g. a NYC restaurant) — it should still resolve via the unbounded fallback.
- Open DevTools → Network: `/api/geocode?...` returns a JSON array of `{ display_name, latitude, longitude }`; a repeat of the same query returns header `x-cache: hit`.

- [ ] **Step 3: Confirm no console/server errors**

Check the browser console and the `npm run dev` terminal — no `Photon 4xx/5xx` throws, no "NOMINATIM_USER_AGENT is not set" (that error path is gone).

- [ ] **Step 4: Stop the dev server.** Nothing to commit — migration complete.

---

## Notes for the executor

- **GeoJSON coordinate order.** Photon's `geometry.coordinates` is `[lon, lat]`. `toHit` destructures `[lon, lat]` and returns `{ latitude: lat, longitude: lon }`. If markers land in the wrong hemisphere, this is the first suspect.
- **`geocodeSearch` contract is frozen.** Two callers (`restaurants.ts`, `migrate-csv.ts`) depend on `{ latitude: number; longitude: number; display_name: string }`. Don't rename those fields.
- **The queue is intentional.** Photon's public instance isn't a CDN for bulk geocoding; the 250ms queue keeps the one-time CSV import polite. For the interactive combobox it's effectively free (300ms client debounce + one-in-flight via `AbortController` already serialize requests).
- **Self-hosting is the upgrade path** if usage ever grows: Photon ships as a runnable JAR with a downloadable prebuilt index — but that's out of scope here.
