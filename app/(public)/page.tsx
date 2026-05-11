import { Suspense } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { RestaurantList } from '@/components/RestaurantList'
import { getAllRestaurants } from '@/lib/queries/restaurants'

export default function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:py-8">
      <Suspense fallback={<ListSkeleton />}>
        <RestaurantsSection />
      </Suspense>
    </div>
  )
}

async function RestaurantsSection() {
  const restaurants = await getAllRestaurants()

  if (restaurants.length === 0) {
    return <NoDataEmpty />
  }

  return <RestaurantList restaurants={restaurants} />
}

function NoDataEmpty() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border/60 px-6 py-24 text-center">
      <h1 className="text-lg font-medium">No restaurants yet</h1>
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-full" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-44 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}
