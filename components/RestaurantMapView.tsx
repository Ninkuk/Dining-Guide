"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CompactStar } from "@/components/CompactStar";
import { StatusIndicator } from "@/components/StatusIndicator";
import { RestaurantMap, type MapMarker } from "@/components/RestaurantMap";
import { restaurantInViewport, type BoundsLiteral } from "@/lib/map-viewport";
import { cn } from "@/lib/utils";
import type { MapPoint, RestaurantWithLocations } from "@/lib/queries/restaurants";

function pickPrimaryCity(locations: RestaurantWithLocations["locations"]): string | null {
  for (const loc of locations) {
    const c = loc.city?.trim();
    if (c) return c;
  }
  return null;
}

function hasGeocodedLocation(r: RestaurantWithLocations): boolean {
  return r.locations.some((loc) => loc.latitude != null && loc.longitude != null);
}

// Shared inner content for a list row, whether it renders as a <button> (a
// mapped restaurant — clicking flies the map there and toggles its popup) or a
// <Link> (a restaurant with no coordinates — nothing to fly to, so it just
// opens the detail page).
function RowBody({
  num,
  name,
  rating,
  city,
  status,
  dimmed,
}: {
  num: number;
  name: string;
  rating: number | null;
  city: string | null;
  status: string;
  dimmed: boolean;
}) {
  return (
    <>
      <span
        aria-hidden
        className={cn(
          "flex size-7 items-center justify-center rounded-full font-mono text-xs tabular-nums",
          dimmed ? "bg-muted text-muted-foreground" : "bg-foreground text-background",
        )}
      >
        {num}
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="font-heading truncate text-sm leading-tight font-medium">{name}</span>
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          <CompactStar rating={rating} className="text-xs" />
          {city ? <span>{city}</span> : null}
        </div>
      </div>
      <StatusIndicator status={status} className="shrink-0" />
    </>
  );
}

const ROW_CLASS =
  "grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl bg-card px-3 py-2.5 text-left ring-1 ring-foreground/10 outline-none transition-[box-shadow] hover:ring-foreground/20 focus-visible:ring-2 focus-visible:ring-ring/50";

export function RestaurantMapView({
  restaurants,
  points,
}: {
  restaurants: RestaurantWithLocations[];
  points: MapPoint[];
}) {
  const [bounds, setBounds] = useState<BoundsLiteral | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);

  const restaurantById = useMemo(() => new Map(restaurants.map((r) => [r.id, r])), [restaurants]);
  const markers: MapMarker[] = useMemo(
    () =>
      points
        .filter((p) => restaurantById.has(p.restaurant_id))
        .map((p) => {
          const r = restaurantById.get(p.restaurant_id)!;
          return {
            ...p,
            cuisine: r.cuisine ?? [],
            notes: r.notes,
            wallet: r.wallet,
            permanently_closed: r.permanently_closed,
          };
        }),
    [points, restaurantById],
  );

  const visibleRestaurants = useMemo(
    () => restaurants.filter((r) => restaurantInViewport(r.locations, bounds)),
    [restaurants, bounds],
  );
  const hiddenCount = restaurants.length - visibleRestaurants.length;

  function toggleSelect(id: number) {
    setSelectedId((prev) => (prev === id ? null : id));
    // On narrow layouts the map sits above the list — make sure the fly-to is
    // actually on screen. `block: 'nearest'` is a no-op when it already is.
    mapRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_minmax(0,1.1fr)]">
      <div className="order-2 flex flex-col gap-2 lg:order-1">
        {hiddenCount > 0 ? (
          <p className="text-muted-foreground px-1 text-xs">
            Showing {visibleRestaurants.length} of {restaurants.length} — zoom out to see more.
          </p>
        ) : null}
        <ol className="flex flex-col gap-2">
          {visibleRestaurants.map((r, i) => {
            const num = i + 1;
            const primaryCity = pickPrimaryCity(r.locations);
            const dimmed = !hasGeocodedLocation(r);
            const body = (
              <RowBody
                num={num}
                name={r.name}
                rating={r.rating}
                city={primaryCity}
                status={r.status}
                dimmed={dimmed}
              />
            );
            return (
              <li key={r.id}>
                {dimmed ? (
                  <Link href={`/${r.slug}`} className={ROW_CLASS}>
                    {body}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleSelect(r.id)}
                    aria-pressed={selectedId === r.id}
                    className={cn(ROW_CLASS, selectedId === r.id && "ring-ring/60 ring-2")}
                  >
                    {body}
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      <div
        ref={mapRef}
        className="ring-foreground/10 order-1 h-[50vh] overflow-hidden rounded-2xl ring-1 lg:sticky lg:top-4 lg:order-2 lg:h-[calc(100vh-3rem)]"
      >
        <RestaurantMap
          markers={markers}
          gestureHandling
          onBoundsChange={setBounds}
          selectedId={selectedId}
          onSelectChange={setSelectedId}
        />
      </div>
    </div>
  );
}
