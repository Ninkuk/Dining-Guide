'use client'

import { useMemo } from 'react'
import {
  parseAsArrayOf,
  parseAsBoolean,
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
} from 'nuqs'
import { Button } from '@/components/ui/button'
import { FilterPanel } from '@/components/FilterPanel'
import { RestaurantCardCompact } from '@/components/RestaurantCardCompact'
import { RestaurantTableView } from '@/components/RestaurantTableView'
import { RestaurantMapView } from '@/components/RestaurantMapView'
import { ViewToggle, type View } from '@/components/ViewToggle'
import type { MapPoint, RestaurantWithLocations } from '@/lib/queries/restaurants'

const SORT_KEYS = ['name', 'rating-desc', 'recent', 'recent-visited'] as const
export type SortKey = (typeof SORT_KEYS)[number]

const VIEW_KEYS = ['cards', 'table', 'map'] as const

const arrayParser = parseAsArrayOf(parseAsString).withDefault([])
const sortParser = parseAsStringLiteral(SORT_KEYS).withDefault('name')
const viewParser = parseAsStringLiteral(VIEW_KEYS).withDefault('cards')

/**
 * Single source of truth for filter/sort/search state.
 *
 * Spec §List view:
 *   - AND across categories, OR within a category
 *   - Search debounced 300ms in URL; immediate in-memory (nuqs `throttleMs`)
 *   - Sort: name | rating desc | recent (created_at)
 */
export function RestaurantList({
  restaurants,
  points,
}: {
  restaurants: RestaurantWithLocations[]
  points: MapPoint[]
}) {
  const [search, setSearch] = useQueryState(
    'q',
    parseAsString.withDefault('').withOptions({ throttleMs: 300 })
  )
  const [cuisines, setCuisines] = useQueryState('cuisine', arrayParser)
  const [cities, setCities] = useQueryState('city', arrayParser)
  const [ratings, setRatings] = useQueryState('rating', arrayParser)
  const [occasions, setOccasions] = useQueryState('occasion', arrayParser)
  const [wallets, setWallets] = useQueryState('wallet', arrayParser)
  const [vegetarians, setVegetarians] = useQueryState('veg', arrayParser)
  const [halals, setHalals] = useQueryState('halal', arrayParser)
  const [statuses, setStatuses] = useQueryState('status', arrayParser)
  const [hideChains, setHideChains] = useQueryState(
    'hideChains',
    parseAsBoolean.withDefault(false)
  )
  const [sort, setSort] = useQueryState('sort', sortParser)
  const [view, setView] = useQueryState('view', viewParser)

  const facets = useMemo(() => buildFacets(restaurants), [restaurants])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()

    const matched = restaurants.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q)) return false

      if (cuisines.length && !r.cuisine.some((c) => cuisines.includes(c))) {
        return false
      }
      if (cities.length && !r.locations.some((loc) => loc.city && cities.includes(loc.city))) {
        return false
      }
      if (ratings.length) {
        const key = r.rating == null ? 'unrated' : String(r.rating)
        if (!ratings.includes(key)) return false
      }
      if (occasions.length && (!r.occasion || !occasions.includes(r.occasion))) {
        return false
      }
      if (wallets.length && (!r.wallet || !wallets.includes(r.wallet))) {
        return false
      }
      if (vegetarians.length) {
        const key = r.vegetarian ?? 'unknown'
        if (!vegetarians.includes(key)) return false
      }
      if (halals.length) {
        const key = r.halal ?? 'unknown'
        if (!halals.includes(key)) return false
      }
      if (statuses.length && !statuses.includes(r.status)) return false
      if (hideChains && r.is_chain) return false

      return true
    })

    return matched.sort((a, b) => {
      switch (sort) {
        case 'rating-desc':
          return (b.rating ?? -1) - (a.rating ?? -1) || a.name.localeCompare(b.name)
        case 'recent':
          return b.created_at.localeCompare(a.created_at)
        case 'recent-visited':
          // nulls last
          if (!a.visited_at && !b.visited_at) return a.name.localeCompare(b.name)
          if (!a.visited_at) return 1
          if (!b.visited_at) return -1
          return b.visited_at.localeCompare(a.visited_at)
        case 'name':
        default:
          return a.name.localeCompare(b.name)
      }
    })
  }, [restaurants, search, cuisines, cities, ratings, occasions, wallets, vegetarians, halals, statuses, hideChains, sort])

  const hasActiveFilters =
    !!search ||
    cuisines.length > 0 ||
    cities.length > 0 ||
    ratings.length > 0 ||
    occasions.length > 0 ||
    wallets.length > 0 ||
    vegetarians.length > 0 ||
    halals.length > 0 ||
    statuses.length > 0 ||
    hideChains ||
    sort !== 'name'

  const clearAll = () => {
    void setSearch(null)
    void setCuisines(null)
    void setCities(null)
    void setRatings(null)
    void setOccasions(null)
    void setWallets(null)
    void setVegetarians(null)
    void setHalals(null)
    void setStatuses(null)
    void setHideChains(null)
    void setSort(null)
  }

  return (
    <div className="flex flex-col gap-6">
      <FilterPanel
        facets={facets}
        search={search}
        onSearchChange={setSearch}
        cuisines={cuisines}
        onCuisinesChange={setCuisines}
        cities={cities}
        onCitiesChange={setCities}
        ratings={ratings}
        onRatingsChange={setRatings}
        occasions={occasions}
        onOccasionsChange={setOccasions}
        wallets={wallets}
        onWalletsChange={setWallets}
        vegetarians={vegetarians}
        onVegetariansChange={setVegetarians}
        halals={halals}
        onHalalsChange={setHalals}
        statuses={statuses}
        onStatusesChange={setStatuses}
        hideChains={hideChains}
        onHideChainsChange={setHideChains}
        sort={sort}
        onSortChange={setSort}
        hasActiveFilters={hasActiveFilters}
        onClearAll={clearAll}
        totalCount={restaurants.length}
        filteredCount={filtered.length}
      />

      <ViewToggle value={view} onChange={setView} />

      {filtered.length === 0 ? (
        <EmptyResults onClearAll={clearAll} hasActiveFilters={hasActiveFilters} />
      ) : (
        <ViewPanel view={view} restaurants={filtered} points={points} />
      )}
    </div>
  )
}

function ViewPanel({
  view,
  restaurants,
  points,
}: {
  view: View
  restaurants: RestaurantWithLocations[]
  points: MapPoint[]
}) {
  if (view === 'table') {
    return (
      <div role="tabpanel" id="view-panel-table" aria-label="Table view">
        <RestaurantTableView restaurants={restaurants} />
      </div>
    )
  }
  if (view === 'map') {
    return (
      <div role="tabpanel" id="view-panel-map" aria-label="Map view">
        <RestaurantMapView restaurants={restaurants} points={points} />
      </div>
    )
  }
  return (
    <div
      role="tabpanel"
      id="view-panel-cards"
      aria-label="Cards view"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {restaurants.map((r) => (
        <RestaurantCardCompact key={r.id} restaurant={r} />
      ))}
    </div>
  )
}

function EmptyResults({
  hasActiveFilters,
  onClearAll,
}: {
  hasActiveFilters: boolean
  onClearAll: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/60 px-6 py-16 text-center">
      <p className="text-sm text-muted-foreground">
        {hasActiveFilters ? 'No restaurants match these filters.' : 'No restaurants yet.'}
      </p>
      {hasActiveFilters ? (
        <Button variant="outline" size="sm" onClick={onClearAll}>
          Clear filters
        </Button>
      ) : null}
    </div>
  )
}

export type Facets = ReturnType<typeof buildFacets>

function buildFacets(restaurants: RestaurantWithLocations[]) {
  const cuisines = new Set<string>()
  const cities = new Set<string>()
  const occasions = new Set<string>()
  for (const r of restaurants) {
    for (const c of r.cuisine ?? []) cuisines.add(c)
    for (const loc of r.locations ?? []) {
      const city = loc.city?.trim()
      if (city) cities.add(city)
    }
    if (r.occasion?.trim()) occasions.add(r.occasion.trim())
  }
  return {
    cuisines: [...cuisines].sort((a, b) => a.localeCompare(b)),
    cities: [...cities].sort((a, b) => a.localeCompare(b)),
    occasions: [...occasions].sort((a, b) => a.localeCompare(b)),
  }
}
