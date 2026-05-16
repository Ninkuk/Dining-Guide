import type { Metadata } from "next";
import type { RestaurantWithLocations } from "@/lib/queries/restaurants";
import { getCuisineEmoji } from "@/lib/cuisines";

/** Canonical origin for the deployed site (also feeds `metadataBase`). */
export const SITE_URL = "https://dining.ninkuk.com";

export const SITE_NAME = "Dining Guide";
export const SITE_TAGLINE = "A dining journal";
export const SITE_DESCRIPTION = "Restaurants we’ve visited and want to try.";

/** Collapse whitespace and hard-trim to `max` chars on a word boundary, adding an ellipsis. */
export function clampText(input: string, max = 160): string {
  const text = input.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * Canonical + Open Graph + Twitter tags for a page, with the site-wide bits
 * (siteName, locale, `summary_large_image`) baked in. Necessary because Next
 * **shallow-merges** metadata across segments — a child that sets `openGraph`
 * or `twitter` fully replaces the layout's, so each page must restate them.
 */
export function socialMetadata(opts: {
  title: string;
  description: string;
  /** Path relative to the site root, e.g. `/` or `/some-slug`. */
  path: string;
  type?: "website" | "article";
  /**
   * OG/Twitter image. Defaults to the generated site card. Pass `null` when the
   * segment has a colocated `opengraph-image` file that should supply it
   * (cross-segment shallow merging would otherwise drop the file's image).
   */
  image?: string | null;
}): Pick<Metadata, "alternates" | "openGraph" | "twitter"> {
  const { title, description, path, type = "website", image = "/opengraph-image" } = opts;
  const images =
    image == null
      ? undefined
      : [{ url: image, width: 1200, height: 630, alt: `${SITE_TAGLINE} — ${SITE_DESCRIPTION}` }];
  return {
    alternates: { canonical: path },
    openGraph: {
      type,
      siteName: SITE_NAME,
      locale: "en_US",
      title,
      description,
      url: path,
      ...(images && { images }),
    },
    twitter: { card: "summary_large_image", title, description, ...(images && { images }) },
  };
}

const STATUS_LABEL: Record<string, string> = {
  visited: "Visited",
  want_to_try: "On the want-to-try list",
};

/** `🍜 Japanese · 🍢 Izakaya` — cuisines with their emoji, for previews. */
export function cuisineLine(cuisine: readonly string[] | null | undefined): string {
  return (cuisine ?? []).map((c) => `${getCuisineEmoji(c)} ${c}`).join(" · ");
}

/** First non-empty city across a restaurant's locations, if any. */
export function primaryCity(r: RestaurantWithLocations): string | null {
  for (const l of r.locations) {
    const city = l.city?.trim();
    if (city) return city;
  }
  return null;
}

/**
 * A one-line description for `<meta name="description">` / OG / Twitter. Prefers
 * the note (it's the centrepiece), then falls back to cuisine · city · status so
 * a photo-less, note-less entry still gets a meaningful preview.
 */
export function restaurantDescription(r: RestaurantWithLocations): string {
  if (r.notes?.trim()) return clampText(r.notes);
  const parts: string[] = [];
  const cuisines = (r.cuisine ?? []).join(", ");
  if (cuisines) parts.push(cuisines);
  const city = primaryCity(r);
  if (city) parts.push(city);
  if (r.permanently_closed) parts.push("Permanently closed");
  else if (STATUS_LABEL[r.status]) parts.push(STATUS_LABEL[r.status]);
  return parts.length ? parts.join(" · ") : SITE_DESCRIPTION;
}
