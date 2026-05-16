import { Suspense } from "react";
import { BackLink } from "@/components/BackLink";
import { Skeleton } from "@/components/ui/skeleton";
import { TipSuggestionForm } from "@/components/public/TipSuggestionForm";
import { getCuisines } from "@/lib/queries/cuisines";

export const metadata = {
  title: "Suggest a restaurant",
  description: "Tip the owner about a place worth visiting.",
  robots: { index: false, follow: false },
};

export default function SuggestPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-6 sm:py-8">
      <header className="flex flex-col gap-3">
        <BackLink preferHistoryBack />
        <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
          Suggest
        </p>
        <h1 className="font-heading text-4xl leading-[1.05] font-medium tracking-tight sm:text-5xl">
          Tip a restaurant
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Send along a place the owner hasn&rsquo;t logged. Tell me who you are — no email asked
          for, no follow-up will be sent. Your tip lands in a private queue; if it ends up on the
          guide, it&rsquo;ll be written in the owner&rsquo;s voice, not yours.
        </p>
      </header>
      <Suspense fallback={<Skeleton className="h-[480px] w-full rounded-2xl" />}>
        <FormHost />
      </Suspense>
    </div>
  );
}

async function FormHost() {
  const cuisines = await getCuisines();
  return <TipSuggestionForm cuisines={cuisines} />;
}
