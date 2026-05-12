import { ClosedBadge } from "@/components/ClosedBadge";
import { StarRating } from "@/components/StarRating";
import { StatusIndicator } from "@/components/StatusIndicator";
import { Badge } from "@/components/ui/badge";
import { getCuisineEmoji } from "@/lib/cuisines";
import type { RestaurantWithLocations } from "@/lib/queries/restaurants";
import { cn } from "@/lib/utils";
import { MapPin } from "lucide-react";
import Link from "next/link";

function pickPrimaryCity(
  locations: RestaurantWithLocations["locations"],
): string | null {
  for (const loc of locations) {
    const c = loc.city?.trim();
    if (c) return c;
  }
  return null;
}

export function RestaurantCardCompact({
  restaurant,
}: {
  restaurant: RestaurantWithLocations;
}) {
  const primaryCity = pickPrimaryCity(restaurant.locations);
  const extraLocationCount =
    restaurant.locations.length > 1 ? restaurant.locations.length - 1 : 0;
  const isTopRated = restaurant.rating === 5;

  return (
    <Link
      href={`/${restaurant.slug}`}
      className="group block h-full rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <article
        className={cn(
          "flex h-full flex-col gap-4 rounded-2xl bg-card p-5 ring-1 transition-all",
          isTopRated
            ? "ring-foreground/25 hover:ring-foreground/40"
            : "ring-foreground/10 hover:ring-foreground/20",
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <StarRating value={restaurant.rating} />
          <div className="flex shrink-0 items-center gap-1.5">
            {restaurant.permanently_closed ? <ClosedBadge /> : null}
            <StatusIndicator status={restaurant.status} />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          {restaurant.cuisine.length > 0 ? (
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {restaurant.cuisine
                .map((c) => `${getCuisineEmoji(c)} ${c}`)
                .join(" · ")}
            </p>
          ) : null}
          <h2
            className={cn(
              "font-heading text-2xl font-medium leading-[1.1] tracking-tight",
              restaurant.permanently_closed &&
                "text-muted-foreground line-through decoration-muted-foreground/40",
            )}
          >
            {restaurant.name}
          </h2>
        </div>

        {restaurant.notes ? (
          <p className="line-clamp-2 text-sm italic text-muted-foreground">
            {restaurant.notes}
          </p>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {primaryCity ? (
            <div className="flex items-center gap-1">
              <MapPin className="size-3.5" strokeWidth={1.75} />
              <span>{primaryCity}</span>
              {extraLocationCount > 0 ? (
                <span className="text-muted-foreground/70">
                  +{extraLocationCount} more
                </span>
              ) : null}
            </div>
          ) : null}
          {restaurant.wallet ? (
            <Badge variant="outline" className="rounded-full">
              {restaurant.wallet}
            </Badge>
          ) : null}
        </div>
      </article>
    </Link>
  );
}
