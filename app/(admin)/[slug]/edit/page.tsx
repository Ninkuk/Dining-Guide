import { Suspense } from "react";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/BackLink";
import { Skeleton } from "@/components/ui/skeleton";
import { RestaurantForm } from "@/components/admin/RestaurantForm";
import { SuggestionBanner } from "@/components/admin/SuggestionBanner";
import { getRestaurantBySlug } from "@/lib/queries/restaurants";
import { getCuisines } from "@/lib/queries/cuisines";
import { createClient } from "@/lib/supabase/server";
import { correctionPayloadSchema, type CorrectionPayload } from "@/lib/suggestions/schema";
import { diffCorrection, type LiveRestaurant } from "@/lib/suggestions/merge";
import { formatDiffChip } from "@/lib/suggestions/diff-chips";
import type { RestaurantInput } from "@/lib/schemas/restaurant";

type Params = { slug: string };
type SearchParams = { from_suggestion?: string };

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  return { title: `Edit ${slug}`, robots: { index: false, follow: false } };
}

export default function EditRestaurantPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-6 sm:py-8">
      <Suspense fallback={<EditSkeleton />}>
        <FormHost params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function EditSkeleton() {
  return (
    <>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <Skeleton className="h-[600px] w-full rounded-2xl" />
    </>
  );
}

async function FormHost({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const [restaurant, cuisines] = await Promise.all([getRestaurantBySlug(slug), getCuisines()]);
  if (!restaurant) notFound();

  const baseDefaults: RestaurantInput = {
    id: restaurant.id,
    name: restaurant.name,
    slug: restaurant.slug,
    cuisine: restaurant.cuisine ?? [],
    occasion: (restaurant.occasion as RestaurantInput["occasion"]) ?? null,
    wallet: (restaurant.wallet as RestaurantInput["wallet"]) ?? null,
    rating: restaurant.rating ?? null,
    vegetarian: (restaurant.vegetarian as RestaurantInput["vegetarian"]) ?? null,
    permanently_closed: !!restaurant.permanently_closed,
    status: (restaurant.status as RestaurantInput["status"]) ?? "visited",
    visited_at: restaurant.visited_at ?? null,
    photo_url: restaurant.photo_url ?? null,
    notes: restaurant.notes ?? null,
    pros: restaurant.pros ?? null,
    cons: restaurant.cons ?? null,
    recommendations: restaurant.recommendations ?? null,
    locations: restaurant.locations.map((l) => ({
      id: l.id,
      city: l.city,
      locality: l.locality,
      address: l.address,
      latitude: l.latitude,
      longitude: l.longitude,
    })),
  };

  // No ?from_suggestion= → the plain edit path.
  const rawId = sp.from_suggestion;
  const id = rawId ? Number(rawId) : NaN;
  if (!Number.isInteger(id) || id <= 0) {
    return (
      <>
        <PlainHeader name={restaurant.name} slug={restaurant.slug} />
        <RestaurantForm mode="edit" defaultValues={baseDefaults} cuisineOptions={cuisines} />
      </>
    );
  }

  // Suggestion-driven pre-fill. Only Corrections that target THIS restaurant
  // are usable here; anything else falls through to the plain edit form.
  const supabase = await createClient();
  const { data: suggestion } = await supabase
    .from("suggestions")
    .select(
      "id, kind, status, target_restaurant_id, submitter_name, anything_else, payload, base_updated_at",
    )
    .eq("id", id)
    .maybeSingle();

  const parsedPayload = suggestion ? correctionPayloadSchema.safeParse(suggestion.payload) : null;

  const usable =
    !!suggestion &&
    suggestion.kind === "correction" &&
    suggestion.status === "pending" &&
    suggestion.target_restaurant_id === restaurant.id &&
    !!parsedPayload?.success;

  if (!usable || !parsedPayload?.success) {
    return (
      <>
        <PlainHeader name={restaurant.name} slug={restaurant.slug} />
        <p className="text-muted-foreground border-border/60 rounded-2xl border border-dashed p-4 text-xs">
          This suggestion is no longer pending (or doesn&rsquo;t target this restaurant). Falling
          back to a plain edit form.
        </p>
        <RestaurantForm mode="edit" defaultValues={baseDefaults} cuisineOptions={cuisines} />
      </>
    );
  }

  const payload = parsedPayload.data;
  const live: LiveRestaurant = {
    id: restaurant.id,
    slug: restaurant.slug,
    name: restaurant.name,
    cuisine: restaurant.cuisine ?? [],
    vegetarian: restaurant.vegetarian,
    permanently_closed: restaurant.permanently_closed,
    photo_url: restaurant.photo_url,
    locations: restaurant.locations.map((l) => ({
      id: l.id,
      city: l.city,
      locality: l.locality,
      address: l.address,
      latitude: l.latitude,
      longitude: l.longitude,
    })),
  };
  const chips = diffCorrection(live, payload).map(formatDiffChip);

  // Stale-base check: live updated_at strictly newer than the snapshot.
  const baseStaleSince =
    suggestion.base_updated_at &&
    new Date(restaurant.updated_at).getTime() > new Date(suggestion.base_updated_at).getTime()
      ? restaurant.updated_at
      : undefined;

  const overlaid = overlayCorrection(baseDefaults, payload);

  return (
    <>
      <PlainHeader name={restaurant.name} slug={restaurant.slug} />
      <SuggestionBanner
        id={suggestion.id}
        kind="correction"
        submitterName={suggestion.submitter_name}
        anythingElse={suggestion.anything_else}
        diffChips={chips}
        baseStaleSince={baseStaleSince}
      />
      <RestaurantForm
        mode="edit"
        defaultValues={overlaid}
        cuisineOptions={cuisines}
        fromSuggestionId={suggestion.id}
      />
    </>
  );
}

function PlainHeader({ name, slug }: { name: string; slug: string }) {
  return (
    <header className="flex flex-col gap-3">
      <BackLink href={`/${slug}`} label={name} preferHistoryBack />
      <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
        Editing
      </p>
      <h1 className="font-heading text-4xl leading-[1.05] font-medium tracking-tight sm:text-5xl">
        {name}
      </h1>
      <p className="text-muted-foreground text-sm">
        Update anything below. Only the name is required.
      </p>
    </header>
  );
}

/**
 * Apply a Correction payload onto the live RestaurantInput defaults. Sparse:
 * any key absent from the payload leaves the live value untouched. The
 * editorial-voice fields are off-whitelist so they're untouched by construction.
 */
function overlayCorrection(defaults: RestaurantInput, p: CorrectionPayload): RestaurantInput {
  const out: RestaurantInput = { ...defaults };
  if (p.name !== undefined) out.name = p.name;
  if (p.permanently_closed !== undefined) out.permanently_closed = p.permanently_closed;
  if (p.cuisine !== undefined) out.cuisine = p.cuisine;
  if (p.vegetarian !== undefined) out.vegetarian = p.vegetarian;
  if (p.photo_url !== undefined) out.photo_url = p.photo_url;
  if (p.locations !== undefined) {
    out.locations = p.locations.map((l) => ({
      id: l.id,
      city: l.city ?? null,
      locality: l.locality ?? null,
      address: l.address ?? null,
      latitude: l.latitude ?? null,
      longitude: l.longitude ?? null,
    }));
  }
  return out;
}
