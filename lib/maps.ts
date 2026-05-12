/**
 * Google Maps "search by coordinates" deep link. Coordinates only (no place
 * name) — works for any lat/lng even when we have no matching POI name.
 * https://developers.google.com/maps/documentation/urls/get-started#search-action
 */
export function googleMapsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
}

/** Google Maps "search by free text" deep link — for when we only have an
 *  address string or place name and no coordinates. */
export function googleMapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}
