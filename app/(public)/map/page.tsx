import { Suspense } from 'react'
import { getForMap } from '@/lib/queries/restaurants'
import { RestaurantMap } from '@/components/RestaurantMap'
import { Skeleton } from '@/components/ui/skeleton'

export const metadata = {
  title: 'Map',
}

async function MapBody() {
  const markers = await getForMap()

  if (markers.length === 0) {
    return (
      <div className="relative h-[calc(100vh-4rem)] w-full">
        <RestaurantMap markers={[]} center={[33.4255, -111.94]} zoom={10} />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-lg border bg-background/90 px-4 py-3 text-sm shadow-md">
            No locations to show.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-4rem)] w-full">
      <RestaurantMap markers={markers} gestureHandling={false} />
    </div>
  )
}

export default function MapPage() {
  return (
    <Suspense
      fallback={<Skeleton className="h-[calc(100vh-4rem)] w-full rounded-none" />}
    >
      <MapBody />
    </Suspense>
  )
}
