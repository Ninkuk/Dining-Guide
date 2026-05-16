import { createAnonClient } from '@/lib/supabase/anon'
import type { Database } from '@/lib/supabase/database.types'

type RestaurantRow = Database['public']['Tables']['restaurants']['Row']
type LocationRow = Database['public']['Tables']['locations']['Row']

export type RestaurantWithLocations = RestaurantRow & {
  locations: LocationRow[]
}

/** All restaurants + nested locations, ordered by name. */
export async function getAllRestaurants(): Promise<RestaurantWithLocations[]> {
  const supabase = createAnonClient()
  const { data, error } = await supabase
    .from('restaurants')
    .select('*, locations(*)')
    .order('name', { ascending: true })

  if (error) {
    throw new Error(`getAllRestaurants failed: ${error.message}`)
  }
  return (data ?? []) as RestaurantWithLocations[]
}

/** Single restaurant by slug (or null when not found). */
export async function getRestaurantBySlug(
  slug: string
): Promise<RestaurantWithLocations | null> {
  const supabase = createAnonClient()
  const { data, error } = await supabase
    .from('restaurants')
    .select('*, locations(*)')
    .eq('slug', slug)
    .maybeSingle()

  if (error) {
    throw new Error(`getRestaurantBySlug(${slug}) failed: ${error.message}`)
  }
  return (data as RestaurantWithLocations | null) ?? null
}

/** Flattened restaurant×location shape consumed by the map view. */
export type MapPoint = {
  restaurant_id: number
  slug: string
  name: string
  status: string
  rating: number | null
  city: string | null
  latitude: number
  longitude: number
}

/** Project geocoded restaurants into a flat marker list. Skips missing lat/lng. */
export function toMapPoints(restaurants: RestaurantWithLocations[]): MapPoint[] {
  return restaurants.flatMap((r) =>
    r.locations
      .filter((l) => l.latitude != null && l.longitude != null)
      .map((l) => ({
        restaurant_id: r.id,
        slug: r.slug,
        name: r.name,
        status: r.status,
        rating: r.rating,
        city: l.city,
        latitude: l.latitude as number,
        longitude: l.longitude as number,
      }))
  )
}

export type StatsData = {
  cuisineCounts: Record<string, number>
  ratingDistribution: Record<'unrated' | '1' | '2' | '3' | '4' | '5', number>
  cityCounts: Record<string, number>
  statusTotals: { visited: number; want_to_try: number }
  occasionCounts: Record<'Quick' | 'Casual' | 'Elevated' | 'Fine Dine' | 'unset', number>
  walletCounts: Record<'Cheap' | 'Normal' | 'Splurge' | 'Big night' | 'unset', number>
  dietaryCounts: {
    vegetarian: { yes: number; no: number; unknown: number }
  }
  closedTotal: number
  totalRestaurants: number
}

/** Pre-aggregated stats for /stats. */
export async function getStatsData(): Promise<StatsData> {
  const all = await getAllRestaurants()

  const cuisineCounts: Record<string, number> = {}
  const ratingDistribution: StatsData['ratingDistribution'] = {
    unrated: 0,
    '1': 0,
    '2': 0,
    '3': 0,
    '4': 0,
    '5': 0,
  }
  const cityCounts: Record<string, number> = {}
  const statusTotals = { visited: 0, want_to_try: 0 }
  const occasionCounts: StatsData['occasionCounts'] = {
    Quick: 0,
    Casual: 0,
    Elevated: 0,
    'Fine Dine': 0,
    unset: 0,
  }
  const walletCounts: StatsData['walletCounts'] = {
    Cheap: 0,
    Normal: 0,
    Splurge: 0,
    'Big night': 0,
    unset: 0,
  }
  const dietaryCounts: StatsData['dietaryCounts'] = {
    vegetarian: { yes: 0, no: 0, unknown: 0 },
  }
  let closedTotal = 0

  for (const r of all) {
    for (const c of r.cuisine ?? []) {
      cuisineCounts[c] = (cuisineCounts[c] ?? 0) + 1
    }

    if (r.rating == null) {
      ratingDistribution.unrated += 1
    } else {
      const key = String(r.rating) as Exclude<keyof StatsData['ratingDistribution'], 'unrated'>
      if (key in ratingDistribution) ratingDistribution[key] += 1
    }

    if (r.status === 'visited') statusTotals.visited += 1
    else if (r.status === 'want_to_try') statusTotals.want_to_try += 1

    const occ = r.occasion as keyof StatsData['occasionCounts'] | null
    if (occ && occ in occasionCounts) occasionCounts[occ] += 1
    else occasionCounts.unset += 1

    const wal = r.wallet as keyof StatsData['walletCounts'] | null
    if (wal && wal in walletCounts) walletCounts[wal] += 1
    else walletCounts.unset += 1

    if (r.vegetarian === 'yes') dietaryCounts.vegetarian.yes += 1
    else if (r.vegetarian === 'no') dietaryCounts.vegetarian.no += 1
    else dietaryCounts.vegetarian.unknown += 1

    if (r.permanently_closed) closedTotal += 1

    for (const loc of r.locations ?? []) {
      const city = loc.city?.trim()
      if (city) cityCounts[city] = (cityCounts[city] ?? 0) + 1
    }
  }

  return {
    cuisineCounts,
    ratingDistribution,
    cityCounts,
    statusTotals,
    occasionCounts,
    walletCounts,
    dietaryCounts,
    closedTotal,
    totalRestaurants: all.length,
  }
}
