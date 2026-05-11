import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { RestaurantForm } from '@/components/admin/RestaurantForm'
import { getCuisines } from '@/lib/queries/cuisines'
import type { RestaurantInput } from '@/lib/schemas/restaurant'

export const metadata = { title: 'New restaurant' }

const DEFAULTS: RestaurantInput = {
  name: '',
  slug: '',
  cuisine: [],
  occasion: null,
  wallet: null,
  rating: null,
  vegetarian: null,
  halal: null,
  is_chain: false,
  status: 'visited',
  visited_at: new Date().toISOString().slice(0, 10),
  photo_url: null,
  notes: null,
  pros: null,
  cons: null,
  recommendations: null,
  locations: [],
}

export default function NewRestaurantPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:py-8">
      <h1 className="text-2xl font-medium tracking-tight">Add restaurant</h1>
      <Suspense fallback={<Skeleton className="h-[600px] w-full rounded-2xl" />}>
        <FormHost />
      </Suspense>
    </div>
  )
}

async function FormHost() {
  const cuisines = await getCuisines()
  return (
    <RestaurantForm
      mode="create"
      defaultValues={DEFAULTS}
      cuisineOptions={cuisines}
    />
  )
}
