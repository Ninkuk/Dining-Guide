/** A plain bounding box. Mirrors what Leaflet's LatLngBounds exposes, but
 *  carries no Leaflet dependency so it stays unit-testable in a node env. */
export type BoundsLiteral = {
  north: number
  south: number
  east: number
  west: number
}

type MaybeGeocoded = { latitude: number | null; longitude: number | null }

function isInside(lat: number, lng: number, b: BoundsLiteral): boolean {
  // West/east comparison assumes a box that does not cross the antimeridian —
  // true for every location this app deals with.
  return lat <= b.north && lat >= b.south && lng <= b.east && lng >= b.west
}

/**
 * Should this restaurant appear in the viewport-filtered Map-view list?
 *
 *  - `bounds == null` (before the first map move event) → yes, show everything.
 *  - No geocoded location at all → yes (it is rendered dimmed regardless of map).
 *  - Otherwise → yes iff at least one geocoded location falls inside `bounds`.
 */
export function restaurantInViewport(
  locations: MaybeGeocoded[],
  bounds: BoundsLiteral | null
): boolean {
  if (bounds == null) return true
  const geocoded = locations.filter(
    (l): l is { latitude: number; longitude: number } =>
      l.latitude != null && l.longitude != null
  )
  if (geocoded.length === 0) return true
  return geocoded.some((l) => isInside(l.latitude, l.longitude, bounds))
}
