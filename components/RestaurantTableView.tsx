import { RestaurantTableRow } from '@/components/RestaurantTableRow'
import type { RestaurantWithLocations } from '@/lib/queries/restaurants'

export function RestaurantTableView({
  restaurants,
}: {
  restaurants: RestaurantWithLocations[]
}) {
  return (
    <ul className="divide-y divide-border/60 overflow-hidden rounded-xl bg-card ring-1 ring-foreground/5">
      {restaurants.map((r) => (
        <RestaurantTableRow key={r.id} restaurant={r} />
      ))}
    </ul>
  )
}
