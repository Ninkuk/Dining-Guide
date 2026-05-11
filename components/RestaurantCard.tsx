import Link from 'next/link'
import Image from 'next/image'
import { MapPin } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { CuisineBadge } from '@/components/CuisineBadge'
import { StarRating } from '@/components/StarRating'
import { StatusIndicator } from '@/components/StatusIndicator'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { RestaurantWithLocations } from '@/lib/queries/restaurants'

function pickPrimaryCity(locations: RestaurantWithLocations['locations']): string | null {
  for (const loc of locations) {
    const c = loc.city?.trim()
    if (c) return c
  }
  return null
}

export function RestaurantCard({ restaurant }: { restaurant: RestaurantWithLocations }) {
  const primaryCity = pickPrimaryCity(restaurant.locations)
  const extraLocationCount = restaurant.locations.length > 1
    ? restaurant.locations.length - 1
    : 0

  return (
    <Link
      href={`/${restaurant.slug}`}
      className="group block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="h-full overflow-hidden p-0 transition-all group-hover:ring-foreground/20">
        {restaurant.photo_url ? (
          <div className="relative aspect-[16/9] w-full bg-muted">
            <Image
              src={restaurant.photo_url}
              alt={restaurant.name}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px"
              className="object-cover"
            />
          </div>
        ) : null}
        <CardHeader className="gap-3 px-5 pt-5">
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="line-clamp-2 text-base leading-snug">
              {restaurant.name}
            </CardTitle>
            <StatusIndicator status={restaurant.status} className="shrink-0" />
          </div>
          <StarRating value={restaurant.rating} />
        </CardHeader>
        <CardContent className="flex flex-col gap-3 px-5 pb-5">
          {restaurant.cuisine.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {restaurant.cuisine.map((c) => (
                <CuisineBadge key={c} name={c} />
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {primaryCity ? (
              <div className="flex items-center gap-1">
                <MapPin className="size-3.5" strokeWidth={1.75} />
                <span>{primaryCity}</span>
                {extraLocationCount > 0 ? (
                  <span className="text-muted-foreground/70">
                    +{extraLocationCount} more
                  </span>
                ) : null}
              </div>
            ) : null}
            {restaurant.wallet ? (
              <Badge variant="outline" className="rounded-full">
                {restaurant.wallet}
              </Badge>
            ) : null}
            {restaurant.is_chain ? (
              <Badge variant="outline" className="rounded-full">
                Chain
              </Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
