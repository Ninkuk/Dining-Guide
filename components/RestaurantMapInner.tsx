'use client'

// The Leaflet-touching half of the map. Loaded only via dynamic({ ssr:false })
// from RestaurantMap.tsx — never imported on the server.

import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet-gesture-handling'

import type { MapMarker } from './RestaurantMap'

// --- Leaflet hardening for fast remounts (dev) ----------------------------
//
// react-leaflet drives the Leaflet map and its layers from React effects:
// <MapContainer> creates/`.remove()`s the map, each <TileLayer>/<Marker>/…
// `map.addLayer()`s / `map.removeLayer()`s itself, and our own <FitBounds>
// `map.setView()`s. Under React 19 StrictMode + Next's `cacheComponents` +
// `next/dynamic`, quickly navigating between pages that both render a map
// interleaves these effects badly:
//
//  • a *deleted* tree's deferred `map.remove()` runs after a fresh map already
//    claimed the same container <div> → "Map container is being reused by
//    another instance" (Map.remove); and
//  • a deferred `map.addLayer()` / `map.setView()` runs *after* the map's own
//    cleanup already tore it down → it touches a torn-down map whose panes are
//    gone ("...getPane() is undefined", "..._leaflet_pos, el is undefined").
//
// Both are benign races against an already-dead map. Patch Leaflet's prototype
// once, at module load (this file is client-only): `remove()` swallows the
// "reused" throw and marks the map dead; mutators no-op once it's dead.
type PatchedMap = L.Map & {
  __diningGuidePatched?: boolean
  _diningGuideRemoved?: boolean
}

function mapIsRemoved(map: L.Map): boolean {
  return (map as PatchedMap)._diningGuideRemoved === true
}

{
  const proto = L.Map.prototype as PatchedMap
  if (!proto.__diningGuidePatched) {
    proto.__diningGuidePatched = true

    const originalRemove = proto.remove
    proto.remove = function patchedRemove(this: PatchedMap) {
      this._diningGuideRemoved = true
      try {
        return originalRemove.call(this)
      } catch (err) {
        if (err instanceof Error && err.message.includes('reused by another instance')) {
          return this
        }
        throw err
      }
    }

    const originalAddLayer = proto.addLayer
    proto.addLayer = function patchedAddLayer(this: PatchedMap, layer: L.Layer) {
      if (this._diningGuideRemoved) return this
      return originalAddLayer.call(this, layer)
    }

    const originalRemoveLayer = proto.removeLayer
    proto.removeLayer = function patchedRemoveLayer(this: PatchedMap, layer: L.Layer) {
      if (this._diningGuideRemoved) return this
      return originalRemoveLayer.call(this, layer)
    }

    const originalWhenReady = proto.whenReady
    proto.whenReady = function patchedWhenReady(
      this: PatchedMap,
      callback: (event: { target: L.Map }) => void,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      context?: any
    ) {
      if (this._diningGuideRemoved) return this
      return originalWhenReady.call(this, callback, context)
    }

    const originalSetView = proto.setView
    proto.setView = function patchedSetView(
      this: PatchedMap,
      ...args: Parameters<L.Map['setView']>
    ) {
      if (this._diningGuideRemoved) return this
      return originalSetView.apply(this, args)
    }

    const originalFitBounds = proto.fitBounds
    proto.fitBounds = function patchedFitBounds(
      this: PatchedMap,
      ...args: Parameters<L.Map['fitBounds']>
    ) {
      if (this._diningGuideRemoved) return this
      return originalFitBounds.apply(this, args)
    }
  }
}
// --------------------------------------------------------------------------

const FILLED_SVG = (color: string) => `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 32" width="28" height="36">
    <path d="M12 0 C5.4 0 0 5.4 0 12 c0 7.5 9 18 11.3 20.5 a1 1 0 0 0 1.4 0 C15 30 24 19.5 24 12 C24 5.4 18.6 0 12 0 z"
          fill="${color}" stroke="#fff" stroke-width="1.5"/>
    <circle cx="12" cy="12" r="4.5" fill="#fff"/>
  </svg>`

const OUTLINED_SVG = (color: string) => `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 32" width="28" height="36">
    <path d="M12 0 C5.4 0 0 5.4 0 12 c0 7.5 9 18 11.3 20.5 a1 1 0 0 0 1.4 0 C15 30 24 19.5 24 12 C24 5.4 18.6 0 12 0 z"
          fill="#fff" stroke="${color}" stroke-width="2"/>
    <circle cx="12" cy="12" r="3" fill="${color}"/>
  </svg>`

function makeIcon(status: 'visited' | 'want_to_try') {
  const color = status === 'visited' ? '#059669' : '#d97706'
  const svg = status === 'visited' ? FILLED_SVG(color) : OUTLINED_SVG(color)
  return L.divIcon({
    html: svg,
    className: 'rg-marker',
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -34],
  })
}

const VISITED_ICON = (() => {
  if (typeof window === 'undefined') return null
  return makeIcon('visited')
})()
const WANT_ICON = (() => {
  if (typeof window === 'undefined') return null
  return makeIcon('want_to_try')
})()

function FitBounds({ markers }: { markers: MapMarker[] }) {
  const map = useMap()
  useEffect(() => {
    if (mapIsRemoved(map)) return
    if (markers.length === 0) return
    if (markers.length === 1) {
      map.setView([markers[0].latitude, markers[0].longitude], 14)
      return
    }
    const bounds = L.latLngBounds(markers.map((m) => [m.latitude, m.longitude]))
    map.fitBounds(bounds, { padding: [40, 40] })
  }, [map, markers])
  return null
}

function GestureHandling({ enabled }: { enabled: boolean }) {
  const map = useMap() as L.Map & { gestureHandling?: { enable: () => void; disable: () => void } }
  useEffect(() => {
    if (mapIsRemoved(map)) return
    if (!map.gestureHandling) return
    if (enabled) map.gestureHandling.enable()
    else map.gestureHandling.disable()
  }, [map, enabled])
  return null
}

export type RestaurantMapInnerProps = {
  markers: MapMarker[]
  center?: [number, number]
  zoom?: number
  gestureHandling?: boolean
  height?: string
}

export default function RestaurantMapInner({
  markers,
  center = [33.4255, -111.94], // Tempe-ish default
  zoom = 10,
  gestureHandling = false,
  height = '100%',
}: RestaurantMapInnerProps) {
  const visited = VISITED_ICON ?? makeIcon('visited')
  const want = WANT_ICON ?? makeIcon('want_to_try')

  const fittedCenter = useMemo<[number, number]>(() => {
    if (markers.length === 1) return [markers[0].latitude, markers[0].longitude]
    return center
  }, [markers, center])

  return (
    <MapContainer
      center={fittedCenter}
      zoom={markers.length === 1 ? 14 : zoom}
      style={{ height, width: '100%' }}
      // gestureHandling is a third-party plugin option, not in react-leaflet's types.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {...({ gestureHandling } as any)}
      scrollWheelZoom={!gestureHandling}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <GestureHandling enabled={gestureHandling} />
      <FitBounds markers={markers} />
      {markers.map((m) => (
        <Marker
          key={`${m.restaurant_id}-${m.latitude}-${m.longitude}`}
          position={[m.latitude, m.longitude]}
          icon={m.status === 'visited' ? visited : want}
        >
          <Popup>
            <div style={{ fontSize: 14 }}>
              <strong>{m.name}</strong>
              <br />
              {m.rating != null ? '★'.repeat(m.rating) + '☆'.repeat(5 - m.rating) : 'Unrated'}
              <br />
              <a href={`/${m.slug}`}>View details →</a>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
