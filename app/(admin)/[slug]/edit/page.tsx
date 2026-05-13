import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { BackLink } from '@/components/BackLink'
import { Skeleton } from '@/components/ui/skeleton'
import { RestaurantForm } from '@/components/admin/RestaurantForm'
import { getRestaurantBySlug } from '@/lib/queries/restaurants'
import { getCuisines } from '@/lib/queries/cuisines'
import type { RestaurantInput } from '@/lib/schemas/restaurant'

type Params = { slug: string }

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { slug } = await params
  return { title: `Edit ${slug}`, robots: { index: false, follow: false } }
}

export default function EditRestaurantPage({
  params,
}: {
  params: Promise<Params>
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-6 sm:py-8">
      <Suspense fallback={<EditSkeleton />}>
        <FormHost params={params} />
      </Suspense>
    </div>
  )
}

function EditSkeleton() {
  return (
    <>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <Skeleton className="h-[600px] w-full rounded-2xl" />
    </>
  )
}

async function FormHost({ params }: { params: Promise<Params> }) {
  const { slug } = await params
  const [restaurant, cuisines] = await Promise.all([
    getRestaurantBySlug(slug),
    getCuisines(),
  ])

  if (!restaurant) notFound()

  const defaults: RestaurantInput = {
    id: restaurant.id,
    name: restaurant.name,
    slug: restaurant.slug,
    cuisine: restaurant.cuisine ?? [],
    occasion: (restaurant.occasion as RestaurantInput['occasion']) ?? null,
    wallet: (restaurant.wallet as RestaurantInput['wallet']) ?? null,
    rating: restaurant.rating ?? null,
    vegetarian: (restaurant.vegetarian as RestaurantInput['vegetarian']) ?? null,
    permanently_closed: !!restaurant.permanently_closed,
    status: (restaurant.status as RestaurantInput['status']) ?? 'visited',
    visited_at: restaurant.visited_at ?? null,
    photo_url: restaurant.photo_url ?? null,
    notes: restaurant.notes ?? null,
    pros: restaurant.pros ?? null,
    cons: restaurant.cons ?? null,
    recommendations: restaurant.recommendations ?? null,
    locations: restaurant.locations.map((l) => ({
      id: l.id,
      city: l.city,
      locality: l.locality,
      address: l.address,
      latitude: l.latitude,
      longitude: l.longitude,
    })),
  }

  return (
    <>
      <header className="flex flex-col gap-3">
        <BackLink href={`/${restaurant.slug}`} label={restaurant.name} preferHistoryBack />
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Editing
        </p>
        <h1 className="font-heading text-4xl font-medium leading-[1.05] tracking-tight sm:text-5xl">
          {restaurant.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          Update anything below. Only the name is required.
        </p>
      </header>
      <RestaurantForm mode="edit" defaultValues={defaults} cuisineOptions={cuisines} />
    </>
  )
}
