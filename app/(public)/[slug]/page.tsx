import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { MapPin, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { BackLink } from '@/components/BackLink'
import { ClosedBadge } from '@/components/ClosedBadge'
import { StarRating } from '@/components/StarRating'
import { StatusIndicator } from '@/components/StatusIndicator'
import { RestaurantMap } from '@/components/RestaurantMap'
import { ShareButton } from '@/components/ShareButton'
import { DeleteRestaurantButton } from '@/components/admin/DeleteRestaurantButton'
import { RestaurantAttributePills } from '@/components/RestaurantAttributePills'
import { getCuisineEmoji } from '@/lib/cuisines'
import { googleMapsUrl, googleMapsSearchUrl } from '@/lib/maps'
import { createClient } from '@/lib/supabase/server'
import { getRestaurantBySlug } from '@/lib/queries/restaurants'
import { restaurantDescription, socialMetadata } from '@/lib/seo'
import { cn } from '@/lib/utils'
import type { Metadata } from 'next'

type Params = { slug: string }

const NOTE_BLOCKS = [
  { key: 'pros', label: "What's good" },
  { key: 'cons', label: "What's not" },
  { key: 'recommendations', label: "When you go" },
] as const

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>
}): Promise<Metadata> {
  const { slug } = await params
  const r = await getRestaurantBySlug(slug)
  if (!r) return { title: 'Not found' }

  const title = r.permanently_closed ? `${r.name} (closed)` : r.name
  const description = restaurantDescription(r)

  return {
    title,
    description,
    ...socialMetadata({ title, description, path: `/${r.slug}`, type: 'article', image: null }),
  }
}

export default function RestaurantPage({
  params,
}: {
  params: Promise<Params>
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:py-8">
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
    city: l.city ?? null,
    latitude: l.latitude as number,
    longitude: l.longitude as number,
    cuisine: r.cuisine ?? [],
    notes: r.notes,
    wallet: r.wallet,
    permanently_closed: r.permanently_closed,
  }))

  const visitedDate =
    r.status === 'visited' && r.visited_at
      ? new Date(r.visited_at).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : null

  const noteBlocks = NOTE_BLOCKS.flatMap((block) => {
    const value = r[block.key]
    return value && value.trim()
      ? [{ key: block.key, label: block.label, value }]
      : []
  })

  return (
    <article className="flex flex-col gap-6">
      <BackLink preferHistoryBack />

      <header className="flex flex-col gap-4">
        {r.cuisine.length > 0 ? (
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {r.cuisine.map((c) => `${getCuisineEmoji(c)} ${c}`).join(' · ')}
          </p>
        ) : null}
        <h1
          className={cn(
            'font-heading text-4xl font-medium leading-[1.05] tracking-tight sm:text-5xl',
            r.permanently_closed &&
              'text-muted-foreground line-through decoration-muted-foreground/40'
          )}
        >
          {r.name}
        </h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <StarRating value={r.rating} size={18} />
          <StatusIndicator status={r.status} />
          {r.permanently_closed ? <ClosedBadge /> : null}
          {visitedDate ? (
            <span className="font-mono text-xs uppercase tracking-wide tabular-nums text-muted-foreground">
              {visitedDate}
            </span>
          ) : null}
        </div>
        <RestaurantAttributePills restaurant={r} />
        <div className="flex items-center gap-3 pt-1">
          <ShareButton name={r.name} slug={r.slug} />
          <AdminActions
            slug={r.slug}
            id={r.id}
            name={r.name}
            locationCount={r.locations.length}
          />
        </div>
      </header>

      {r.photo_url ? (
        <div className="relative aspect-[3/1] w-full overflow-hidden rounded-2xl ring-1 ring-foreground/10">
          <Image
            src={r.photo_url}
            alt={r.name}
            fill
            sizes="(max-width: 768px) 100vw, 672px"
            className="object-cover"
          />
        </div>
      ) : null}

      {r.notes ? (
        <p className="text-lg leading-relaxed whitespace-pre-wrap text-foreground">
          {r.notes}
        </p>
      ) : null}

      {noteBlocks.length > 0 ? (
        <div className="flex flex-col">
          {noteBlocks.map(({ key, label, value }) => (
            <div key={key} className="border-b border-border/60 py-5 first:pt-0">
              <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {label}
              </p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                {value}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <section className="flex flex-col gap-4">
        <div className="flex items-baseline gap-3 border-b border-border/60 pb-3">
          <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Where
          </h2>
        </div>
        {r.locations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No specific locations recorded yet.
          </p>
        ) : (
          <>
            <ul className="flex flex-col gap-3">
              {r.locations.map((l, i) => {
                const href =
                  l.latitude != null && l.longitude != null
                    ? googleMapsUrl(l.latitude, l.longitude)
                    : l.address
                      ? googleMapsSearchUrl(l.address)
                      : l.city
                        ? googleMapsSearchUrl(l.city)
                        : null
                const body = (
                  <>
                    <MapPin
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      strokeWidth={1.75}
                    />
                    <span>
                      {l.city ?? (
                        <span className="italic text-muted-foreground">No city</span>
                      )}
                      {l.locality ? (
                        <span className="text-muted-foreground"> · {l.locality}</span>
                      ) : null}
                      {l.address ? (
                        <span className="block text-xs text-muted-foreground">
                          {l.address}
                        </span>
                      ) : null}
                    </span>
                  </>
                )
                return (
                  <li key={l.id ?? i} className="text-sm">
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open in Google Maps"
                        className="group -mx-2 flex items-start gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                      >
                        {body}
                      </a>
                    ) : (
                      <div className="flex items-start gap-2.5">{body}</div>
                    )}
                  </li>
                )
              })}
            </ul>
            {mapMarkers.length > 0 ? (
              <div className="h-[300px] w-full overflow-hidden rounded-2xl ring-1 ring-foreground/10">
                <RestaurantMap markers={mapMarkers} gestureHandling height="100%" popups={false} />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No mapped coordinates for this one yet.
              </p>
            )}
          </>
        )}
      </section>
    </article>
  )
}

/**
 * Auth-aware admin controls (Edit + Delete). Lives OUTSIDE the `'use cache'`
 * boundary because it reads cookies; the rest of the page is cacheable. Renders
 * nothing for the public — both the markup and the affordance stay hidden.
 */
async function AdminActions({
  slug,
  id,
  name,
  locationCount,
}: {
  slug: string
  id: number
  name: string
  locationCount: number
}) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims) return null
  return (
    <>
      <Button asChild size="sm" variant="outline">
        <Link href={`/${slug}/edit`}>
          <Pencil className="size-4" />
          Edit
        </Link>
      </Button>
      <DeleteRestaurantButton id={id} name={name} locationCount={locationCount} />
    </>
  )
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-4 w-24" />
      <div className="flex flex-col gap-4">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="h-5 w-1/3" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-7 w-24 rounded-full" />
          ))}
        </div>
        <Skeleton className="h-8 w-36" />
      </div>
      <Skeleton className="h-24 w-full rounded-2xl" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
      <Skeleton className="h-[300px] w-full rounded-2xl" />
    </div>
  )
}
