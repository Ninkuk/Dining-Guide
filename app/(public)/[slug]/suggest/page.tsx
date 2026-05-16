import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BackLink } from "@/components/BackLink";
import { Skeleton } from "@/components/ui/skeleton";
import { CorrectionSuggestionForm } from "@/components/public/CorrectionSuggestionForm";
import { getCuisines } from "@/lib/queries/cuisines";
import { getRestaurantBySlug } from "@/lib/queries/restaurants";

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const r = await getRestaurantBySlug(slug);
  if (!r) return { title: "Not found" };
  return {
    title: `Suggest an edit — ${r.name}`,
    description: `Propose a correction to ${r.name}.`,
    robots: { index: false, follow: false },
  };
}

export default function SuggestCorrectionPage({ params }: { params: Promise<Params> }) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-6 sm:py-8">
      <Suspense fallback={<Skeleton className="h-[520px] w-full rounded-2xl" />}>
        <Body params={params} />
      </Suspense>
    </div>
  );
}

async function Body({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const [restaurant, cuisines] = await Promise.all([getRestaurantBySlug(slug), getCuisines()]);
  if (!restaurant) notFound();

  return (
    <>
      <header className="flex flex-col gap-3">
        <BackLink preferHistoryBack href={`/${restaurant.slug}`} label={restaurant.name} />
        <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
          Suggest an edit
        </p>
        <h1 className="font-heading text-4xl leading-[1.05] font-medium tracking-tight sm:text-5xl">
          {restaurant.name}
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Propose a factual correction — name, closed status, cuisines, vegetarian, locations, or a
          note in &ldquo;anything else&rdquo;. The owner&rsquo;s voice fields (the note,
          what&rsquo;s good / not / when you go, rating, occasion, wallet) aren&rsquo;t editable
          from here. Your edit lands in a private queue; if accepted, the change is written in the
          owner&rsquo;s voice. Tell me who you are — no email asked for, no follow-up will be sent.
        </p>
      </header>
      <CorrectionSuggestionForm restaurant={restaurant} cuisines={cuisines} />
    </>
  );
}
