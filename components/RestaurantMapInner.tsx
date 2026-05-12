'use client'

// The Leaflet-touching half of the map. Loaded only via dynamic({ ssr:false })
// from RestaurantMap.tsx — never imported on the server.

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, LayersControl } from 'react-leaflet'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { ArrowUpRight, LocateFixed, MapPin } from 'lucide-react'
import { toast } from 'sonner'
import L from 'leaflet'
import 'leaflet-gesture-handling'

import type { MapMarker } from './RestaurantMap'
import type { BoundsLiteral } from '@/lib/map-viewport'
import { googleMapsUrl } from '@/lib/maps'
import { getCuisineEmoji } from '@/lib/cuisines'
import { cn } from '@/lib/utils'
import { StarRating } from '@/components/StarRating'
import { StatusIndicator } from '@/components/StatusIndicator'
import { ClosedBadge } from '@/components/ClosedBadge'
import { Badge } from '@/components/ui/badge'

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

    const originalFlyTo = proto.flyTo
    proto.flyTo = function patchedFlyTo(
      this: PatchedMap,
      ...args: Parameters<L.Map['flyTo']>
    ) {
      if (this._diningGuideRemoved) return this
      return originalFlyTo.apply(this, args)
    }

    // The chokepoint for nearly every fast-remount teardown crash: a deferred
    // layer/overlay update (tile `_update`, popup `_adjustPan`, …) calls into
    // pixel math that reads `getPosition(this._mapPane)` — and `_mapPane` is
    // already gone. Leaflet's own `|| Point(0,0)` fallback never runs because
    // `getPosition(undefined)` throws first. Short-circuit to a zero point.
    const pProto = proto as PatchedMap & {
      _mapPane?: HTMLElement
      _getMapPanePos: () => L.Point
    }
    const originalGetMapPanePos = pProto._getMapPanePos
    pProto._getMapPanePos = function patchedGetMapPanePos(this: typeof pProto) {
      if (!this._mapPane || this._diningGuideRemoved) return L.point(0, 0)
      return originalGetMapPanePos.call(this)
    }
  }
}

// `<LayersControl>` (and any other L.Control) adds itself via React effects.
// On a fast remount its deferred `addTo` can run against a map that's already
// been `.remove()`d — `map._controlCorners` is gone → "can't access property
// 'topright', map._controlCorners is undefined". Bail in that case.
{
  type PatchedControlProto = typeof L.Control.prototype & { __diningGuidePatched?: boolean }
  const controlProto = L.Control.prototype as PatchedControlProto
  if (!controlProto.__diningGuidePatched) {
    controlProto.__diningGuidePatched = true
    const originalAddTo = controlProto.addTo
    controlProto.addTo = function patchedControlAddTo(this: L.Control, map: L.Map) {
      const m = map as PatchedMap & { _controlCorners?: unknown }
      if (m._diningGuideRemoved || !m._controlCorners) return this
      return originalAddTo.call(this, map)
    }
  }
}

// A tile layer schedules a debounced `_update` (via requestAnimFrame) on
// moveend. After a fast remount that callback can fire once the map's panes
// are already gone — `getCenter()` → `_getMapPanePos()` → `getPosition(el)`
// with `el` undefined → "can't access property '_leaflet_pos', el is
// undefined". Bail when the layer's map is missing or already removed.
{
  type GridProto = {
    __diningGuidePatched?: boolean
    _update: (center?: unknown) => unknown
    _map?: PatchedMap & { _mapPane?: unknown }
  }
  const gridProto = L.GridLayer.prototype as unknown as GridProto
  if (!gridProto.__diningGuidePatched) {
    gridProto.__diningGuidePatched = true
    const originalUpdate = gridProto._update
    gridProto._update = function patchedGridUpdate(this: GridProto, center?: unknown) {
      const m = this._map
      if (!m || m._diningGuideRemoved || !m._mapPane) return
      return originalUpdate.call(this, center)
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

const LOCATE_DOT_ICON =
  typeof window === 'undefined'
    ? null
    : L.divIcon({
        html: '<div class="rg-locate-dot" style="width:16px;height:16px"></div>',
        className: 'rg-locate-marker',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      })

function LocateControl() {
  const map = useMap()
  const layerRef = useRef<L.LayerGroup | null>(null)
  const [busy, setBusy] = useState(false)
  const [container, setContainer] = useState<HTMLElement | null>(null)

  // A real L.Control, mounted under the zoom +/- bar (a JSX `leaflet-control`
  // div would spawn a second corner stack that overlaps the zoom buttons). We
  // portal React into its container so the icon stays a normal lucide element.
  useEffect(() => {
    if (mapIsRemoved(map)) return
    const LocateCtl = L.Control.extend({
      options: { position: 'topleft' as L.ControlPosition },
      onAdd(): HTMLElement {
        const el = L.DomUtil.create('div', 'leaflet-bar leaflet-control')
        L.DomEvent.disableClickPropagation(el)
        L.DomEvent.disableScrollPropagation(el)
        return el
      },
    })
    const ctl = new LocateCtl()
    ctl.addTo(map)
    // Imperatively-created DOM node → React state so we can portal into it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setContainer((ctl.getContainer() as HTMLElement | undefined) ?? null)
    return () => {
      ctl.remove()
      setContainer(null)
      if (layerRef.current && !mapIsRemoved(map)) layerRef.current.remove()
      layerRef.current = null
    }
  }, [map])

  function locate() {
    if (mapIsRemoved(map)) return
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      toast.error('Location is not available in this browser.')
      return
    }
    setBusy(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false)
        if (mapIsRemoved(map)) return
        const here: [number, number] = [pos.coords.latitude, pos.coords.longitude]
        if (!layerRef.current) {
          layerRef.current = L.layerGroup().addTo(map)
        }
        layerRef.current.clearLayers()
        const dot =
          LOCATE_DOT_ICON ??
          L.divIcon({
            html: '<div class="rg-locate-dot" style="width:16px;height:16px"></div>',
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          })
        L.marker(here, { icon: dot, interactive: false }).addTo(layerRef.current)
        if (pos.coords.accuracy && pos.coords.accuracy < 5000) {
          L.circle(here, {
            radius: pos.coords.accuracy,
            color: '#2563eb',
            weight: 1,
            fillColor: '#2563eb',
            fillOpacity: 0.1,
            interactive: false,
          }).addTo(layerRef.current)
        }
        map.setView(here, 14)
      },
      (err) => {
        setBusy(false)
        toast.error(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied.'
            : 'Could not determine your location.'
        )
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  if (!container) return null
  // Leaflet's `.leaflet-bar a` styles (block, 26×26, centered line-box) lay the
  // link out; the lucide icon just needs to sit inline-middle. Stroke is forced
  // dark so it's visible on Leaflet's always-white control background.
  return createPortal(
    <a
      href="#"
      role="button"
      aria-label="Show my location"
      title="Show my location"
      aria-busy={busy}
      style={{ textIndent: 0 }}
      onClick={(e) => {
        e.preventDefault()
        locate()
      }}
    >
      <LocateFixed
        size={16}
        strokeWidth={2.25}
        aria-hidden
        className="inline-block align-middle"
        style={{ color: '#404040' }}
      />
    </a>,
    container
  )
}

// A map popup that reads like a small RestaurantCardCompact: rating ←→ status,
// cuisine kicker, name, an italic notes snippet, then city · wallet — plus one
// quiet "Open in Google Maps" affordance the list card doesn't need. The
// bubble's surface (bg / ring / radius) comes from the `.leaflet-popup-*`
// rules in globals.css, so this just lays out the contents.
function MarkerCard({ marker }: { marker: MapMarker }) {
  const cuisines = marker.cuisine ?? []
  return (
    <div className="flex w-72 flex-col gap-2.5 p-4">
      <Link href={`/${marker.slug}`} className="group flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-3">
          <StarRating value={marker.rating} />
          <div className="flex shrink-0 items-center gap-1.5">
            {marker.permanently_closed ? <ClosedBadge /> : null}
            <StatusIndicator status={marker.status} />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          {cuisines.length > 0 ? (
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {cuisines.map((c) => `${getCuisineEmoji(c)} ${c}`).join(' · ')}
            </p>
          ) : null}
          <h2
            className={cn(
              'font-heading text-2xl font-medium leading-[1.1] tracking-tight',
              marker.permanently_closed &&
                'text-muted-foreground line-through decoration-muted-foreground/40'
            )}
          >
            {marker.name}
          </h2>
        </div>

        {marker.notes ? (
          <p className="line-clamp-2 text-sm italic text-muted-foreground">{marker.notes}</p>
        ) : null}

        {marker.city || marker.wallet ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {marker.city ? (
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5" strokeWidth={1.75} />
                {marker.city}
              </span>
            ) : null}
            {marker.wallet ? (
              <Badge variant="outline" className="rounded-full font-normal">
                {marker.wallet}
              </Badge>
            ) : null}
          </div>
        ) : null}
      </Link>

      {/* link color comes from `.leaflet-popup-content a` in globals.css —
          Leaflet's unlayered `a` rule can't be beaten by a Tailwind utility */}
      <a
        href={googleMapsUrl(marker.latitude, marker.longitude)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-fit items-center gap-1 text-xs transition-colors"
      >
        Open in Google Maps
        <ArrowUpRight className="size-3" aria-hidden />
      </a>
    </div>
  )
}

// --- Base tile layers ------------------------------------------------------
// All keyless. CARTO basemaps need the OSM + CARTO attribution; Esri World
// Imagery needs the Esri/Maxar credit and uses {z}/{y}/{x} ordering with no
// {s} subdomain (easy to get wrong — this is the only place it matters).

const CARTO_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
const ESRI_IMAGERY_ATTR =
  'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
const ESRI_TOPO_ATTR =
  'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, USGS, NRCAN, METI, iPC'

type BaseLayerId = 'light' | 'dark' | 'satellite' | 'terrain'

function BaseLayers({ initial }: { initial: BaseLayerId }) {
  const map = useMap()
  const { resolvedTheme } = useTheme()
  const lightRef = useRef<L.TileLayer | null>(null)
  const darkRef = useRef<L.TileLayer | null>(null)

  // Follow the app's light/dark mode — but only swap when the *current* basemap
  // is one of the CARTO themed pair. If the user has picked Satellite or
  // Terrain, leave it alone. Adding/removing the registered base layers also
  // updates the LayersControl radio (Leaflet's control listens to layeradd /
  // layerremove). Guard against `resolvedTheme === undefined` on first render.
  useEffect(() => {
    const light = lightRef.current
    const dark = darkRef.current
    if (!light || !dark || mapIsRemoved(map)) return
    if (resolvedTheme !== 'light' && resolvedTheme !== 'dark') return
    if (resolvedTheme === 'dark' && map.hasLayer(light)) {
      map.removeLayer(light)
      map.addLayer(dark)
    } else if (resolvedTheme === 'light' && map.hasLayer(dark)) {
      map.removeLayer(dark)
      map.addLayer(light)
    }
  }, [map, resolvedTheme])

  return (
    <>
      <LayersControl.BaseLayer name="Light" checked={initial === 'light'}>
        <TileLayer
          ref={lightRef}
          attribution={CARTO_ATTR}
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
      </LayersControl.BaseLayer>
      <LayersControl.BaseLayer name="Dark" checked={initial === 'dark'}>
        <TileLayer
          ref={darkRef}
          attribution={CARTO_ATTR}
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
      </LayersControl.BaseLayer>
      <LayersControl.BaseLayer name="Satellite" checked={initial === 'satellite'}>
        <TileLayer
          attribution={ESRI_IMAGERY_ATTR}
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          maxZoom={19}
        />
      </LayersControl.BaseLayer>
      <LayersControl.BaseLayer name="Terrain" checked={initial === 'terrain'}>
        <TileLayer
          attribution={ESRI_TOPO_ATTR}
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"
          maxZoom={19}
        />
      </LayersControl.BaseLayer>
    </>
  )
}

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

function reportBounds(map: L.Map, cb: (b: BoundsLiteral) => void) {
  if (mapIsRemoved(map)) return
  const b = map.getBounds()
  cb({ north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() })
}

function MapEvents({ onBoundsChange }: { onBoundsChange?: (b: BoundsLiteral) => void }) {
  const map = useMapEvents({
    moveend() {
      if (onBoundsChange) reportBounds(map, onBoundsChange)
    },
    zoomend() {
      if (onBoundsChange) reportBounds(map, onBoundsChange)
    },
  })
  // Emit once on mount too (covers the initial FitBounds fit).
  useEffect(() => {
    if (onBoundsChange) reportBounds(map, onBoundsChange)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
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

function RestaurantMarkers({
  markers,
  visited,
  want,
  selectedId,
  onSelectChange,
}: {
  markers: MapMarker[]
  visited: L.DivIcon
  want: L.DivIcon
  selectedId: number | null
  onSelectChange: (id: number | null) => void
}) {
  const map = useMap()
  const markerRefs = useRef<Map<number, L.Marker>>(new Map())

  // Selecting a restaurant — from a pin tap *or* from the list row — flies to
  // it and opens its popup; clearing the selection closes any open popup.
  useEffect(() => {
    if (mapIsRemoved(map)) return
    if (selectedId == null) {
      map.closePopup()
      return
    }
    const m = markers.find((x) => x.restaurant_id === selectedId)
    if (!m) return
    map.flyTo([m.latitude, m.longitude], Math.max(map.getZoom(), 15))
    markerRefs.current.get(selectedId)?.openPopup()
  }, [map, markers, selectedId])

  // Tapping empty map deselects.
  useEffect(() => {
    if (mapIsRemoved(map)) return
    const onClick = () => onSelectChange(null)
    map.on('click', onClick)
    return () => {
      map.off('click', onClick)
    }
  }, [map, onSelectChange])

  return (
    <>
      {markers.map((m) => (
        <Marker
          key={`${m.restaurant_id}-${m.latitude}-${m.longitude}`}
          position={[m.latitude, m.longitude]}
          icon={m.status === 'visited' ? visited : want}
          ref={(instance) => {
            if (instance) markerRefs.current.set(m.restaurant_id, instance)
            else markerRefs.current.delete(m.restaurant_id)
          }}
          eventHandlers={{
            click: () => onSelectChange(selectedId === m.restaurant_id ? null : m.restaurant_id),
          }}
        >
          <Popup closeOnClick={false} closeButton={false}>
            <MarkerCard marker={m} />
          </Popup>
        </Marker>
      ))}
    </>
  )
}

export type RestaurantMapInnerProps = {
  markers: MapMarker[]
  center?: [number, number]
  zoom?: number
  gestureHandling?: boolean
  height?: string
  onBoundsChange?: (bounds: BoundsLiteral) => void
  selectedId?: number | null
  onSelectChange?: (id: number | null) => void
}

export default function RestaurantMapInner({
  markers,
  center = [33.4255, -111.94], // Tempe-ish default
  zoom = 10,
  gestureHandling = false,
  height = '100%',
  onBoundsChange,
  selectedId = null,
  onSelectChange,
}: RestaurantMapInnerProps) {
  // next-themes writes the `dark` class on <html> via a blocking pre-hydration
  // script, so reading it synchronously here is reliable — and it sidesteps
  // next-themes' `resolvedTheme` being briefly `undefined` on the first render.
  // (<LayersControl>'s checked base layer is honored only at mount anyway.)
  const [initialLayer] = useState<BaseLayerId>(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
      ? 'dark'
      : 'light'
  )
  // Selection is controlled by the parent (the Map view, which also drives it
  // from the list); fall back to internal state when used standalone.
  const [internalSelected, setInternalSelected] = useState<number | null>(null)
  const selected = onSelectChange ? selectedId : internalSelected
  const handleSelectChange = onSelectChange ?? setInternalSelected

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
      <LayersControl position="topright">
        <BaseLayers initial={initialLayer} />
      </LayersControl>
      <GestureHandling enabled={gestureHandling} />
      <FitBounds markers={markers} />
      <MapEvents onBoundsChange={onBoundsChange} />
      <LocateControl />
      <RestaurantMarkers
        markers={markers}
        visited={visited}
        want={want}
        selectedId={selected}
        onSelectChange={handleSelectChange}
      />
    </MapContainer>
  )
}
