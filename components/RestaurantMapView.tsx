'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { CompactStar } from '@/components/CompactStar'
import { StatusIndicator } from '@/components/StatusIndicator'
import { RestaurantMap, type MapMarker } from '@/components/RestaurantMap'
import { cn } from '@/lib/utils'
import type { MapPoint, RestaurantWithLocations } from '@/lib/queries/restaurants'

function pickPrimaryCity(locations: RestaurantWithLocations['locations']): string | null {
  for (const loc of locations) {
    const c = loc.city?.trim()
    if (c) return c
  }
  return null
}

function hasGeocodedLocation(r: RestaurantWithLocations): boolean {
  return r.locations.some(
    (loc) => loc.latitude != null && loc.longitude != null
  )
}

export function RestaurantMapView({
  restaurants,
  points,
}: {
  restaurants: RestaurantWithLocations[]
  points: MapPoint[]
}) {
  const visibleIds = useMemo(
    () => new Set(restaurants.map((r) => r.id)),
    [restaurants]
  )
  const markers: MapMarker[] = useMemo(
    () => points.filter((p) => visibleIds.has(p.restaurant_id)),
    [points, visibleIds]
  )

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_minmax(0,1.1fr)]">
      <ol className="order-2 flex flex-col gap-2 lg:order-1">
        {restaurants.map((r, i) => {
          const num = i + 1
          const primaryCity = pickPrimaryCity(r.locations)
          const dimmed = !hasGeocodedLocation(r)
          return (
            <li key={r.id}>
              <Link
                href={`/${r.slug}`}
                className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl bg-card px-3 py-2.5 ring-1 ring-foreground/10 outline-none transition-colors hover:ring-foreground/20 focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <span
                  className={cn(
                    'flex size-7 items-center justify-center rounded-full font-mono text-xs tabular-nums',
                    dimmed
                      ? 'bg-muted text-muted-foreground'
                      : 'bg-foreground text-background'
                  )}
                  aria-label={`Pin ${num}`}
                >
                  {num}
                </span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate font-heading text-sm font-medium leading-tight">
                    {r.name}
                  </span>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                    <CompactStar rating={r.rating} className="text-xs" />
                    {primaryCity ? <span>{primaryCity}</span> : null}
                  </div>
                </div>
                <StatusIndicator status={r.status} className="shrink-0" />
              </Link>
            </li>
          )
        })}
      </ol>

      <div className="order-1 h-[50vh] overflow-hidden rounded-2xl ring-1 ring-foreground/10 lg:sticky lg:top-4 lg:order-2 lg:h-[calc(100vh-3rem)]">
        <RestaurantMap markers={markers} gestureHandling />
      </div>
    </div>
  )
}
