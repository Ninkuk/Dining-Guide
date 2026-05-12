/**
 * Google Maps "search by coordinates" deep link. Coordinates only (no place
 * name) — works for any lat/lng even when we have no matching POI name.
 * https://developers.google.com/maps/documentation/urls/get-started#search-action
 */
export function googleMapsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
}
