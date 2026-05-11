import { Suspense } from 'react'
import { BackLink } from '@/components/BackLink'
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
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-6 sm:py-8">
      <header className="flex flex-col gap-3">
        <BackLink />
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          New entry
        </p>
        <h1 className="font-heading text-4xl font-medium leading-[1.05] tracking-tight sm:text-5xl">
          Add a restaurant
        </h1>
        <p className="text-sm text-muted-foreground">
          Five movements — the basics, your write-up, the details, where it is, and (optionally)
          a photo. Nothing here is required except a name.
        </p>
      </header>
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
