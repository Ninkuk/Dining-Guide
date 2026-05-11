import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { MapPin, Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { CuisineBadge } from '@/components/CuisineBadge'
import { StarRating } from '@/components/StarRating'
import { StatusIndicator } from '@/components/StatusIndicator'
import { RestaurantMap } from '@/components/RestaurantMap'
import { createClient } from '@/lib/supabase/server'
import { getRestaurantBySlug } from '@/lib/queries/restaurants'
import type { RestaurantWithLocations } from '@/lib/queries/restaurants'

type Params = { slug: string }

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { slug } = await params
  const r = await getRestaurantBySlug(slug)
  if (!r) return { title: 'Not found' }
  return { title: r.name }
}

export default function RestaurantPage({
  params,
}: {
  params: Promise<Params>
}) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:py-8">
      <Suspense fallback={<DetailSkeleton />}>
        <DetailBody params={params} />
      </Suspense>
    </div>
  )
}

async function DetailBody({ params }: { params: Promise<Params> }) {
  const { slug } = await params
  const r = await getRestaurantBySlug(slug)
  if (!r) notFound()

  const geocoded = r.locations.filter(
    (l) => l.latitude != null && l.longitude != null
  )
  const mapMarkers = geocoded.map((l) => ({
    restaurant_id: r.id,
    slug: r.slug,
    name: r.name,
    status: r.status,
    rating: r.rating,
    latitude: l.latitude as number,
    longitude: l.longitude as number,
  }))

  return (
    <article className="flex flex-col gap-6">
      {r.photo_url ? (
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl border">
          <Image
            src={r.photo_url}
            alt={r.name}
            fill
            sizes="(max-width: 768px) 100vw, 800px"
            className="object-cover"
          />
        </div>
      ) : null}

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">
              {r.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <StatusIndicator status={r.status} />
              {r.is_chain ? (
                <Badge variant="outline" className="rounded-full">
                  Chain
                </Badge>
              ) : null}
            </div>
          </div>
          <EditButton slug={r.slug} />
        </div>
        <StarRating value={r.rating} />
        {r.cuisine.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {r.cuisine.map((c) => (
              <CuisineBadge key={c} name={c} />
            ))}
          </div>
        ) : null}
      </header>

      <MetaGrid r={r} />

      <NotesSection r={r} />

      <LocationsSection r={r} markerCount={mapMarkers.length} />

      <div className="h-[360px] w-full overflow-hidden rounded-2xl border">
        <RestaurantMap markers={mapMarkers} gestureHandling={true} />
      </div>
    </article>
  )
}

function MetaGrid({ r }: { r: RestaurantWithLocations }) {
  const items: Array<[string, string | null]> = [
    ['Occasion', r.occasion],
    ['Wallet', r.wallet],
    ['Vegetarian', r.vegetarian],
    ['Halal', r.halal],
    [
      'Visited',
      r.visited_at
        ? new Date(r.visited_at).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })
        : null,
    ],
  ]
  const populated = items.filter(([, v]) => v != null && v !== '')

  if (populated.length === 0) return null

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl border bg-card p-4 text-sm sm:grid-cols-3">
      {populated.map(([label, value]) => (
        <div key={label} className="flex flex-col gap-0.5">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            {label}
          </dt>
          <dd className="font-medium capitalize">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function NotesSection({ r }: { r: RestaurantWithLocations }) {
  const blocks: Array<[string, string | null]> = [
    ['Notes', r.notes],
    ['Pros', r.pros],
    ['Cons', r.cons],
    ['Recommendations', r.recommendations],
  ]
  const populated = blocks.filter(([, v]) => v && v.trim().length > 0)
  if (populated.length === 0) return null

  return (
    <section className="flex flex-col gap-3">
      {populated.map(([label, value]) => (
        <Card key={label}>
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
              {label}
            </CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm leading-relaxed">
            {value}
          </CardContent>
        </Card>
      ))}
    </section>
  )
}

function LocationsSection({
  r,
  markerCount,
}: {
  r: RestaurantWithLocations
  markerCount: number
}) {
  if (r.locations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No specific locations recorded yet.
      </p>
    )
  }
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        {r.locations.length === 1 ? 'Location' : `Locations (${r.locations.length})`}
      </h2>
      <ul className="flex flex-col divide-y rounded-2xl border bg-card">
        {r.locations.map((l, i) => (
          <li key={l.id ?? i} className="flex items-start gap-3 px-4 py-3 text-sm">
            <MapPin
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              strokeWidth={1.75}
            />
            <div className="flex flex-col gap-0.5">
              <div className="font-medium">
                {l.city ?? <span className="italic text-muted-foreground">No city</span>}
                {l.locality ? (
                  <span className="text-muted-foreground"> · {l.locality}</span>
                ) : null}
              </div>
              {l.address ? (
                <div className="text-xs text-muted-foreground">{l.address}</div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {markerCount === 0 ? (
        <p className="text-xs text-muted-foreground">
          No geocoded coordinates — mini-map will be empty.
        </p>
      ) : null}
      <Separator className="mt-2" />
    </section>
  )
}

/**
 * Auth-aware "Edit" button. Lives OUTSIDE the `'use cache'` boundary because it
 * reads cookies; the rest of the page is cacheable.
 */
async function EditButton({ slug }: { slug: string }) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims) return null
  return (
    <Button asChild size="sm" variant="outline">
      <Link href={`/${slug}/edit`}>
        <Pencil className="size-4" />
        Edit
      </Link>
    </Button>
  )
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="aspect-[16/9] w-full rounded-2xl" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-32 w-full rounded-2xl" />
      <Skeleton className="h-[360px] w-full rounded-2xl" />
    </div>
  )
}
