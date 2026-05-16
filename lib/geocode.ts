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
  /** Locality parsed from the result's structured components (city/town/village), or null. */
  city: string | null;
};

type PhotonProperties = Record<string, string | number | undefined>;
type PhotonFeature = { geometry: { coordinates: [number, number] }; properties: PhotonProperties };

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

/**
 * The locality from Photon's structured properties — city, falling back to
 * town/village. Deliberately *not* `county`: `formatPhotonLabel` uses county as
 * a last resort for the display string, but "Maricopa County" is a poor default
 * to auto-fill into a City field. The admin can still type one by hand.
 */
export function photonCity(p: PhotonProperties): string | null {
  return String(p.city ?? p.town ?? p.village ?? "").trim() || null;
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
    city: photonCity(f.properties),
  };
}

type PhotonOpts = { limit: number; bias?: { lat: number; lon: number }; bbox?: string };

function photon(q: string, opts: PhotonOpts): Promise<PhotonFeature[]> {
  return queue.enqueue(async () => {
    const url = new URL(PHOTON_BASE);
    url.searchParams.set("q", q);
    url.searchParams.set("lang", "en"); // request English labels for the composed display_name
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
