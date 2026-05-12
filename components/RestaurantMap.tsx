'use client'

// Public client-side entry for the map. Dynamically imports the Leaflet-touching
// inner component so it never hits SSR — Leaflet reads `window` on module load.

import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'
import type { BoundsLiteral } from '@/lib/map-viewport'

export type MapMarker = {
  restaurant_id: number
  slug: string
  name: string
  status: string
  rating: number | null
  city: string | null
  latitude: number
  longitude: number
}

const Inner = dynamic(() => import('./RestaurantMapInner'), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
})

export type RestaurantMapProps = {
  markers: MapMarker[]
  center?: [number, number]
  zoom?: number
  gestureHandling?: boolean
  height?: string
  onBoundsChange?: (bounds: BoundsLiteral) => void
  selectedId?: number | null
  onSelectChange?: (id: number | null) => void
}

export function RestaurantMap(props: RestaurantMapProps) {
  return <Inner {...props} />
}
