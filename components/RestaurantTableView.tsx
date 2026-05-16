import { RestaurantTableRow } from "@/components/RestaurantTableRow";
import type { RestaurantWithLocations } from "@/lib/queries/restaurants";

export function RestaurantTableView({ restaurants }: { restaurants: RestaurantWithLocations[] }) {
  return (
    <ul className="divide-border/60 bg-card ring-foreground/5 divide-y overflow-hidden rounded-xl ring-1">
      {restaurants.map((r) => (
        <RestaurantTableRow key={r.id} restaurant={r} />
      ))}
    </ul>
  );
}
