import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { RestaurantForm } from '@/components/admin/RestaurantForm'
import { getRestaurantBySlug } from '@/lib/queries/restaurants'
import { getCuisines } from '@/lib/queries/cuisines'
import type { RestaurantInput } from '@/lib/schemas/restaurant'

type Params = { slug: string }

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { slug } = await params
  return { title: `Edit ${slug}` }
}

export default function EditRestaurantPage({
  params,
}: {
  params: Promise<Params>
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:py-8">
      <h1 className="text-2xl font-medium tracking-tight">Edit restaurant</h1>
      <Suspense fallback={<Skeleton className="h-[600px] w-full rounded-2xl" />}>
        <FormHost params={params} />
      </Suspense>
    </div>
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
    halal: (restaurant.halal as RestaurantInput['halal']) ?? null,
    is_chain: !!restaurant.is_chain,
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

  return <RestaurantForm mode="edit" defaultValues={defaults} cuisineOptions={cuisines} />
}
