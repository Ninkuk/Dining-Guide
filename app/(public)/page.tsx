import { Suspense } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EditorialHeader } from '@/components/EditorialHeader'
import { RestaurantList } from '@/components/RestaurantList'
import { getAllRestaurants, getForMap } from '@/lib/queries/restaurants'
import type { RestaurantWithLocations } from '@/lib/queries/restaurants'
import type { Metadata } from 'next'
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, socialMetadata } from '@/lib/seo'

export const metadata: Metadata = socialMetadata({
  title: `${SITE_NAME} — ${SITE_TAGLINE}`,
  description: SITE_DESCRIPTION,
  path: '/',
})

export default function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-6 sm:py-10">
      <Suspense fallback={<ListSkeleton />}>
        <RestaurantsSection />
      </Suspense>
    </div>
  )
}

async function RestaurantsSection() {
  const [restaurants, points] = await Promise.all([
    getAllRestaurants(),
    getForMap(),
  ])

  if (restaurants.length === 0) {
    return (
      <>
        <EditorialHeader visited={0} cities={0} cuisines={0} />
        <NoDataEmpty />
      </>
    )
  }

  const counts = summarize(restaurants)

  return (
    <>
      <EditorialHeader
        visited={counts.visited}
        cities={counts.cities}
        cuisines={counts.cuisines}
      />
      <RestaurantList restaurants={restaurants} points={points} />
    </>
  )
}

function summarize(restaurants: RestaurantWithLocations[]) {
  const cities = new Set<string>()
  const cuisines = new Set<string>()
  let visited = 0
  for (const r of restaurants) {
    if (r.status === 'visited') visited += 1
    for (const c of r.cuisine ?? []) cuisines.add(c)
    for (const loc of r.locations ?? []) {
      const city = loc.city?.trim()
      if (city) cities.add(city)
    }
  }
  return { visited, cities: cities.size, cuisines: cuisines.size }
}

function NoDataEmpty() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border/60 px-6 py-24 text-center">
      <h2 className="text-lg font-medium">No restaurants yet</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        Sign in as the admin and add your first one. Public visitors will see
        cards here once data is loaded.
      </p>
      <Button asChild size="sm">
        <Link href="/auth/login">Sign in to add</Link>
      </Button>
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3 border-b border-border/60 pb-6">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-3 w-48" />
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-full" />
        ))}
      </div>
      <Skeleton className="mx-auto h-10 w-64 rounded-full" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-52 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}
