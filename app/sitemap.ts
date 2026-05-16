import type { MetadataRoute } from "next";
import { getAllRestaurants } from "@/lib/queries/restaurants";
import { SITE_URL } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const restaurants = await getAllRestaurants();

  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/stats`, changeFrequency: "monthly", priority: 0.4 },
    ...restaurants.map((r) => ({
      url: `${SITE_URL}/${r.slug}`,
      lastModified: r.updated_at,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
