import { formatDateOnly } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { RestaurantWithLocations } from "@/lib/queries/restaurants";

type Attribute = {
  emoji: string;
  label: string;
  /** `null` ⇒ render the pill grayed out with "Unknown". */
  value: string | null;
};

function yesNo(value: string | null): string | null {
  if (value === "yes") return "Yes";
  if (value === "no") return "No";
  return null;
}

/**
 * The four at-a-glance attributes (occasion · wallet · vegetarian ·
 * visited/status). Every pill always renders; a missing value fades to a
 * grayed "Unknown" — a data-completeness cue, not a de-emphasis.
 */
export function RestaurantAttributePills({
  restaurant: r,
}: {
  restaurant: RestaurantWithLocations;
}) {
  const attributes: Attribute[] = [
    { emoji: "🍽️", label: "Occasion", value: r.occasion?.trim() || null },
    { emoji: "💸", label: "Wallet", value: r.wallet?.trim() || null },
    { emoji: "🥦", label: "Vegetarian", value: yesNo(r.vegetarian) },
    r.status === "visited"
      ? {
          emoji: "📅",
          label: "Visited",
          value: r.visited_at ? formatDateOnly(r.visited_at) : null,
        }
      : { emoji: "📅", label: "Status", value: "Want to try" },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {attributes.map(({ emoji, label, value }) => {
        const known = value != null;
        return (
          <span
            key={label}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm ring-1",
              known
                ? "bg-card text-foreground ring-foreground/10"
                : "bg-muted/60 text-muted-foreground/60 ring-foreground/5",
            )}
          >
            <span aria-hidden>{emoji}</span>
            <span className={cn(known && "text-muted-foreground")}>{label}</span>
            <span className={cn(known && "font-medium")}>{known ? value : "Unknown"}</span>
          </span>
        );
      })}
    </div>
  );
}
