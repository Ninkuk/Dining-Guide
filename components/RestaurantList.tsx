"use client";

import { useMemo } from "react";
import { parseAsArrayOf, parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { Button } from "@/components/ui/button";
import { FilterPanel } from "@/components/FilterPanel";
import { RestaurantCardCompact } from "@/components/RestaurantCardCompact";
import { RestaurantTableView } from "@/components/RestaurantTableView";
import { RestaurantMapView } from "@/components/RestaurantMapView";
import { ViewToggle, type View } from "@/components/ViewToggle";
import type { MapPoint, RestaurantWithLocations } from "@/lib/queries/restaurants";

const SORT_KEYS = ["name", "rating-desc", "recent", "recent-visited"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

const VIEW_KEYS = ["cards", "table", "map"] as const;

const arrayParser = parseAsArrayOf(parseAsString).withDefault([]);
const sortParser = parseAsStringLiteral(SORT_KEYS).withDefault("rating-desc");
const viewParser = parseAsStringLiteral(VIEW_KEYS).withDefault("cards");

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
  restaurants: RestaurantWithLocations[];
  points: MapPoint[];
}) {
  const [search, setSearch] = useQueryState(
    "q",
    parseAsString.withDefault("").withOptions({ throttleMs: 300 }),
  );
  const [cuisines, setCuisines] = useQueryState("cuisine", arrayParser);
  const [cities, setCities] = useQueryState("city", arrayParser);
  const [ratings, setRatings] = useQueryState("rating", arrayParser);
  const [occasions, setOccasions] = useQueryState("occasion", arrayParser);
  const [wallets, setWallets] = useQueryState("wallet", arrayParser);
  const [vegetarians, setVegetarians] = useQueryState("veg", arrayParser);
  const [statuses, setStatuses] = useQueryState("status", arrayParser);
  const [sort, setSort] = useQueryState("sort", sortParser);
  const [view, setView] = useQueryState("view", viewParser);

  const facets = useMemo(() => buildFacets(restaurants), [restaurants]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    const matched = restaurants.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q)) return false;

      if (cuisines.length && !r.cuisine.some((c) => cuisines.includes(c))) {
        return false;
      }
      if (cities.length && !r.locations.some((loc) => loc.city && cities.includes(loc.city))) {
        return false;
      }
      if (ratings.length) {
        const key = r.rating == null ? "unrated" : String(r.rating);
        if (!ratings.includes(key)) return false;
      }
      if (occasions.length && (!r.occasion || !occasions.includes(r.occasion))) {
        return false;
      }
      if (wallets.length && (!r.wallet || !wallets.includes(r.wallet))) {
        return false;
      }
      if (vegetarians.length) {
        const key = r.vegetarian ?? "unknown";
        if (!vegetarians.includes(key)) return false;
      }
      if (statuses.length) {
        const matchesStatus = statuses.includes(r.status);
        const matchesClosed = statuses.includes("permanently_closed") && r.permanently_closed;
        if (!matchesStatus && !matchesClosed) return false;
      }

      return true;
    });

    return matched.sort((a, b) => {
      switch (sort) {
        case "rating-desc":
          return (b.rating ?? -1) - (a.rating ?? -1) || a.name.localeCompare(b.name);
        case "recent":
          return b.created_at.localeCompare(a.created_at);
        case "recent-visited":
          // nulls last
          if (!a.visited_at && !b.visited_at) return a.name.localeCompare(b.name);
          if (!a.visited_at) return 1;
          if (!b.visited_at) return -1;
          return b.visited_at.localeCompare(a.visited_at);
        case "name":
        default:
          return a.name.localeCompare(b.name);
      }
    });
  }, [
    restaurants,
    search,
    cuisines,
    cities,
    ratings,
    occasions,
    wallets,
    vegetarians,
    statuses,
    sort,
  ]);

  const activeFilterCount =
    [cuisines, cities, ratings, occasions, wallets, vegetarians, statuses].filter(
      (a) => a.length > 0,
    ).length + (sort !== "rating-desc" ? 1 : 0);

  const hasActiveFilters = !!search || activeFilterCount > 0;

  const clearAll = () => {
    void setSearch(null);
    void setCuisines(null);
    void setCities(null);
    void setRatings(null);
    void setOccasions(null);
    void setWallets(null);
    void setVegetarians(null);
    void setStatuses(null);
    void setSort(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <FilterPanel
        facets={facets}
        search={search}
        onSearchChange={(v) => void setSearch(v)}
        cuisines={cuisines}
        onCuisinesChange={(v) => void setCuisines(v)}
        cities={cities}
        onCitiesChange={(v) => void setCities(v)}
        ratings={ratings}
        onRatingsChange={(v) => void setRatings(v)}
        occasions={occasions}
        onOccasionsChange={(v) => void setOccasions(v)}
        wallets={wallets}
        onWalletsChange={(v) => void setWallets(v)}
        vegetarians={vegetarians}
        onVegetariansChange={(v) => void setVegetarians(v)}
        statuses={statuses}
        onStatusesChange={(v) => void setStatuses(v)}
        sort={sort}
        onSortChange={(v) => void setSort(v)}
        hasActiveFilters={hasActiveFilters}
        activeFilterCount={activeFilterCount}
        onClearAll={clearAll}
        totalCount={restaurants.length}
        filteredCount={filtered.length}
      />

      <ViewToggle value={view} onChange={(v) => void setView(v)} />

      {filtered.length === 0 ? (
        <EmptyResults onClearAll={clearAll} hasActiveFilters={hasActiveFilters} />
      ) : (
        <ViewPanel view={view} restaurants={filtered} points={points} />
      )}
    </div>
  );
}

function ViewPanel({
  view,
  restaurants,
  points,
}: {
  view: View;
  restaurants: RestaurantWithLocations[];
  points: MapPoint[];
}) {
  if (view === "table") {
    return (
      <div key="table" role="tabpanel" id="view-panel-table" aria-label="Table view">
        <RestaurantTableView restaurants={restaurants} />
      </div>
    );
  }
  if (view === "map") {
    return (
      <div key="map" role="tabpanel" id="view-panel-map" aria-label="Map view">
        <RestaurantMapView restaurants={restaurants} points={points} />
      </div>
    );
  }
  return (
    <div
      key="cards"
      role="tabpanel"
      id="view-panel-cards"
      aria-label="Cards view"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {restaurants.map((r) => (
        <RestaurantCardCompact key={r.id} restaurant={r} />
      ))}
    </div>
  );
}

function EmptyResults({
  hasActiveFilters,
  onClearAll,
}: {
  hasActiveFilters: boolean;
  onClearAll: () => void;
}) {
  return (
    <div className="border-border/60 flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-16 text-center">
      <p className="text-muted-foreground text-sm">
        {hasActiveFilters ? "No restaurants match these filters." : "No restaurants yet."}
      </p>
      {hasActiveFilters ? (
        <Button variant="outline" size="sm" onClick={onClearAll}>
          Clear filters
        </Button>
      ) : null}
    </div>
  );
}

export type Facets = ReturnType<typeof buildFacets>;

function buildFacets(restaurants: RestaurantWithLocations[]) {
  const cuisines = new Set<string>();
  const cities = new Set<string>();
  const occasions = new Set<string>();
  for (const r of restaurants) {
    for (const c of r.cuisine ?? []) cuisines.add(c);
    for (const loc of r.locations ?? []) {
      const city = loc.city?.trim();
      if (city) cities.add(city);
    }
    if (r.occasion?.trim()) occasions.add(r.occasion.trim());
  }
  return {
    cuisines: [...cuisines].sort((a, b) => a.localeCompare(b)),
    cities: [...cities].sort((a, b) => a.localeCompare(b)),
    occasions: [...occasions].sort((a, b) => a.localeCompare(b)),
  };
}
