import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { CompactStar } from '@/components/CompactStar'
import { StatusIndicator } from '@/components/StatusIndicator'
import { getCuisineEmoji } from '@/lib/cuisines'
import type { RestaurantWithLocations } from '@/lib/queries/restaurants'

function pickPrimaryCity(locations: RestaurantWithLocations['locations']): string | null {
  for (const loc of locations) {
    const c = loc.city?.trim()
    if (c) return c
  }
  return null
}

export function RestaurantTableRow({
  restaurant,
}: {
  restaurant: RestaurantWithLocations
}) {
  const primaryCity = pickPrimaryCity(restaurant.locations)
  const primaryCuisine = restaurant.cuisine[0] ?? null
  const remainingCuisines = restaurant.cuisine.slice(1)
  const cuisineLabel = restaurant.cuisine.join(' · ')

  return (
    <li>
      <Link
        href={`/${restaurant.slug}`}
        className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-3 outline-none transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <span
          aria-hidden
          className="flex size-9 items-center justify-center rounded-lg bg-muted text-base"
        >
          {primaryCuisine ? getCuisineEmoji(primaryCuisine) : '🍽️'}
        </span>

        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="truncate font-heading text-base font-medium leading-tight">
              {restaurant.name}
            </span>
            <CompactStar rating={restaurant.rating} className="text-xs" />
            {primaryCity ? (
              <span className="text-xs text-muted-foreground">{primaryCity}</span>
            ) : null}
          </div>
          {cuisineLabel || restaurant.wallet ? (
            <div className="truncate text-xs text-muted-foreground">
              {cuisineLabel}
              {cuisineLabel && restaurant.wallet ? (
                <span aria-hidden> · </span>
              ) : null}
              {restaurant.wallet ?? null}
              {remainingCuisines.length === 0 && restaurant.is_chain ? (
                <>
                  <span aria-hidden> · </span>
                  <span>Chain</span>
                </>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <StatusIndicator status={restaurant.status} className="shrink-0" />
          <ChevronRight
            className="size-4 text-muted-foreground/60"
            strokeWidth={1.75}
            aria-hidden
          />
        </div>
      </Link>
    </li>
  )
}
