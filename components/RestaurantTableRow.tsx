import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ClosedBadge } from "@/components/ClosedBadge";
import { CompactStar } from "@/components/CompactStar";
import { StatusIndicator } from "@/components/StatusIndicator";
import { getCuisineEmoji } from "@/lib/cuisines";
import { cn } from "@/lib/utils";
import type { RestaurantWithLocations } from "@/lib/queries/restaurants";

function pickPrimaryCity(locations: RestaurantWithLocations["locations"]): string | null {
  for (const loc of locations) {
    const c = loc.city?.trim();
    if (c) return c;
  }
  return null;
}

export function RestaurantTableRow({ restaurant }: { restaurant: RestaurantWithLocations }) {
  const primaryCity = pickPrimaryCity(restaurant.locations);
  const primaryCuisine = restaurant.cuisine[0] ?? null;
  const cuisineLabel = restaurant.cuisine.join(" · ");

  return (
    <li>
      <Link
        href={`/${restaurant.slug}`}
        className="hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-ring/50 grid grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-3 transition-colors outline-none focus-visible:ring-2"
      >
        <span
          aria-hidden
          className="bg-muted flex size-9 items-center justify-center rounded-lg text-base"
        >
          {primaryCuisine ? getCuisineEmoji(primaryCuisine) : "🍽️"}
        </span>

        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span
              className={cn(
                "font-heading truncate text-base leading-tight font-medium",
                restaurant.permanently_closed &&
                  "text-muted-foreground decoration-muted-foreground/40 line-through",
              )}
            >
              {restaurant.name}
            </span>
            <CompactStar rating={restaurant.rating} className="text-xs" />
            {primaryCity ? (
              <span className="text-muted-foreground text-xs">{primaryCity}</span>
            ) : null}
          </div>
          {cuisineLabel || restaurant.wallet ? (
            <div className="text-muted-foreground truncate text-xs">
              {cuisineLabel}
              {cuisineLabel && restaurant.wallet ? <span aria-hidden> · </span> : null}
              {restaurant.wallet ?? null}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {restaurant.permanently_closed ? <ClosedBadge className="shrink-0" /> : null}
          <StatusIndicator status={restaurant.status} className="shrink-0" />
          <ChevronRight
            className="text-muted-foreground/60 size-4"
            strokeWidth={1.75}
            aria-hidden
          />
        </div>
      </Link>
    </li>
  );
}
