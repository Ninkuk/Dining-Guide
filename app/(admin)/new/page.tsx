import { Suspense } from "react";
import { BackLink } from "@/components/BackLink";
import { Skeleton } from "@/components/ui/skeleton";
import { RestaurantForm } from "@/components/admin/RestaurantForm";
import { SuggestionBanner } from "@/components/admin/SuggestionBanner";
import { todayDateOnly } from "@/lib/dates";
import { getCuisines } from "@/lib/queries/cuisines";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/slug";
import { tipPayloadSchema } from "@/lib/suggestions/schema";
import type { RestaurantInput } from "@/lib/schemas/restaurant";

export const metadata = {
  title: "New restaurant",
  robots: { index: false, follow: false },
};

type SearchParams = { from_suggestion?: string };

const BLANK_DEFAULTS: RestaurantInput = {
  name: "",
  slug: "",
  cuisine: [],
  occasion: null,
  wallet: null,
  rating: null,
  vegetarian: null,
  permanently_closed: false,
  status: "visited",
  visited_at: todayDateOnly(),
  photo_url: null,
  notes: null,
  pros: null,
  cons: null,
  recommendations: null,
  locations: [],
};

export default function NewRestaurantPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-6 sm:py-8">
      <Suspense fallback={<Skeleton className="h-[600px] w-full rounded-2xl" />}>
        <Body searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Body({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const rawId = params.from_suggestion;
  const id = rawId ? Number(rawId) : NaN;
  const wantsSuggestion = Number.isInteger(id) && id > 0;

  const cuisines = await getCuisines();

  // No `?from_suggestion=` → the original blank-form path.
  if (!wantsSuggestion) {
    return (
      <>
        <header className="flex flex-col gap-3">
          <BackLink preferHistoryBack />
          <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
            New entry
          </p>
          <h1 className="font-heading text-4xl leading-[1.05] font-medium tracking-tight sm:text-5xl">
            Add a restaurant
          </h1>
          <p className="text-muted-foreground text-sm">
            Five movements — the basics, your write-up, the details, where it is, and (optionally) a
            photo. Nothing here is required except a name.
          </p>
        </header>
        <RestaurantForm mode="create" defaultValues={BLANK_DEFAULTS} cuisineOptions={cuisines} />
      </>
    );
  }

  // Suggestion-driven pre-fill. Only Tips can route through /new (Corrections
  // go through /[slug]/edit per ADR-0002 — that's issue #9).
  const supabase = await createClient();
  const { data: suggestion } = await supabase
    .from("suggestions")
    .select("id, kind, status, submitter_name, payload, anything_else")
    .eq("id", id)
    .maybeSingle();

  // Silently fall through to a blank-with-header form when the Suggestion is
  // missing, already decided, or the wrong kind. (Better than 404ing on a stale
  // queue tab.) The admin sees a faint banner explaining; the form still works.
  const usable =
    suggestion &&
    suggestion.status === "pending" &&
    suggestion.kind === "tip" &&
    tipPayloadSchema.safeParse(suggestion.payload).success;

  const defaults = usable
    ? mergeTipIntoDefaults(suggestion.payload, BLANK_DEFAULTS)
    : BLANK_DEFAULTS;

  return (
    <>
      <header className="flex flex-col gap-3">
        <BackLink preferHistoryBack href="/suggestions" label="Suggestions" />
        <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
          New entry
        </p>
        <h1 className="font-heading text-4xl leading-[1.05] font-medium tracking-tight sm:text-5xl">
          {usable ? defaults.name || "Add a restaurant" : "Add a restaurant"}
        </h1>
        <p className="text-muted-foreground text-sm">
          {usable
            ? "Fields are pre-filled from the tip. Add your personal-context details (occasion, wallet, rating, the note) and save to apply."
            : "This suggestion is no longer pending (or wasn't a Tip). Starting with a blank form."}
        </p>
      </header>
      {usable ? (
        <SuggestionBanner
          id={suggestion.id}
          kind="tip"
          submitterName={suggestion.submitter_name}
          anythingElse={suggestion.anything_else}
        />
      ) : null}
      <RestaurantForm
        mode="create"
        defaultValues={defaults}
        cuisineOptions={cuisines}
        fromSuggestionId={usable ? suggestion.id : undefined}
      />
    </>
  );
}

function mergeTipIntoDefaults(payload: unknown, blanks: RestaurantInput): RestaurantInput {
  const parsed = tipPayloadSchema.safeParse(payload);
  if (!parsed.success) return blanks;
  const p = parsed.data;
  return {
    ...blanks,
    name: p.name ?? blanks.name,
    slug: p.name ? slugify(p.name) : blanks.slug,
    cuisine: p.cuisine ?? blanks.cuisine,
    vegetarian: p.vegetarian ?? blanks.vegetarian,
    permanently_closed: p.permanently_closed ?? blanks.permanently_closed,
    photo_url: p.photo_url ?? blanks.photo_url,
    locations:
      p.locations && p.locations.length > 0
        ? p.locations.map((l) => ({
            city: l.city ?? null,
            locality: l.locality ?? null,
            address: l.address ?? null,
            latitude: l.latitude ?? null,
            longitude: l.longitude ?? null,
          }))
        : blanks.locations,
  };
}
