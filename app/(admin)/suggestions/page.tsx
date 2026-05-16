// Admin moderation queue for Suggestions. Auth-gated by the proxy
// (lib/supabase/proxy.ts adds /suggestions(/.*)? to its write-route patterns),
// so anonymous visitors get redirected to /auth/login.
//
// v1 covers pending-list display + reject. Accept happens via the existing
// edit/new form with `?from_suggestion=<id>` in a later slice (ADR-0002).

import { Suspense } from "react";
import Link from "next/link";
import { BackLink } from "@/components/BackLink";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RejectSuggestionButton } from "@/components/admin/RejectSuggestionButton";
import { createClient } from "@/lib/supabase/server";
import { diffCorrection, type LiveRestaurant } from "@/lib/suggestions/merge";
import { formatDiffChip } from "@/lib/suggestions/diff-chips";
import type { CorrectionPayload } from "@/lib/suggestions/schema";

export const metadata = {
  title: "Suggestions queue",
  robots: { index: false, follow: false },
};

export default function SuggestionsPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-6 sm:py-8">
      <header className="flex flex-col gap-3">
        <BackLink preferHistoryBack />
        <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
          Admin
        </p>
        <h1 className="font-heading text-4xl leading-[1.05] font-medium tracking-tight sm:text-5xl">
          Suggestions
        </h1>
        <p className="text-muted-foreground text-sm">
          Pending tips and corrections from anonymous readers. Accept by opening the pre-filled edit
          form (later slice); reject to dismiss.
        </p>
      </header>
      <Suspense fallback={<Skeleton className="h-[280px] w-full rounded-2xl" />}>
        <Queue />
      </Suspense>
    </div>
  );
}

function formatRelativeFromNow(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diffSec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`;
  if (diffSec < 86_400) return `${Math.round(diffSec / 3600)}h ago`;
  return `${Math.round(diffSec / 86_400)}d ago`;
}

async function Queue() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suggestions")
    .select("id, kind, target_restaurant_id, submitter_name, anything_else, created_at, payload")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="border-destructive/40 text-destructive rounded-2xl border p-6 text-sm">
        Couldn&rsquo;t load the queue: {error.message}
      </div>
    );
  }

  const rows = data ?? [];
  if (rows.length === 0) {
    return (
      <div className="border-border/60 text-muted-foreground rounded-2xl border border-dashed p-8 text-center text-sm">
        Nothing pending. The queue is empty.
      </div>
    );
  }

  // Resolve target restaurants in one batched read. We need the full live shape
  // for diffCorrection (not just name/slug), so the select widens accordingly.
  const targetIds = rows.map((r) => r.target_restaurant_id).filter((v): v is number => v != null);
  const targetsById = new Map<number, LiveRestaurant & { name: string; slug: string }>();
  if (targetIds.length > 0) {
    const { data: targets } = await supabase
      .from("restaurants")
      .select(
        "id, slug, name, cuisine, vegetarian, permanently_closed, photo_url, locations(id, city, locality, address, latitude, longitude)",
      )
      .in("id", targetIds);
    for (const t of targets ?? []) {
      targetsById.set(t.id, {
        id: t.id,
        slug: t.slug,
        name: t.name,
        cuisine: t.cuisine ?? [],
        vegetarian: t.vegetarian,
        permanently_closed: t.permanently_closed,
        photo_url: t.photo_url,
        locations: (t.locations ?? []).map((l) => ({
          id: l.id,
          city: l.city,
          locality: l.locality,
          address: l.address,
          latitude: l.latitude,
          longitude: l.longitude,
        })),
      });
    }
  }

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((s) => {
        const target = s.target_restaurant_id ? targetsById.get(s.target_restaurant_id) : null;
        const chips =
          s.kind === "correction" && target
            ? diffCorrection(target, (s.payload ?? {}) as CorrectionPayload).map(formatDiffChip)
            : [];
        return (
          <li
            key={s.id}
            className="bg-card ring-foreground/10 hover:ring-foreground/20 flex flex-col gap-3 rounded-2xl p-5 ring-1 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 font-mono text-[10px] tracking-wide uppercase">
                  {s.kind}
                </span>
                <span>by {s.submitter_name}</span>
                <span aria-hidden>·</span>
                <span className="font-mono tabular-nums">
                  {formatRelativeFromNow(s.created_at)}
                </span>
              </div>
              <p className="text-base font-medium">
                {s.kind === "tip"
                  ? "New restaurant tip"
                  : target
                    ? `Correction for ${target.name}`
                    : "Correction (target missing)"}
              </p>
              {chips.length > 0 ? (
                <ul className="mt-0.5 flex flex-wrap gap-1.5">
                  {chips.map((c) => (
                    <li
                      key={c.label}
                      className="bg-muted/60 text-muted-foreground ring-foreground/10 inline-flex items-baseline gap-1.5 rounded-full px-2.5 py-0.5 text-xs ring-1"
                    >
                      <span className="font-mono text-[10px] tracking-wide uppercase">
                        {c.label}
                      </span>
                      <span className="text-foreground/90">{c.detail}</span>
                    </li>
                  ))}
                </ul>
              ) : s.kind === "correction" && !s.anything_else ? (
                <p className="text-muted-foreground text-xs italic">
                  No field changes — anything-else only.
                </p>
              ) : null}
              {s.anything_else ? (
                <p className="text-muted-foreground text-sm leading-relaxed">
                  &ldquo;{s.anything_else}&rdquo;
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {s.kind === "tip" ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/new?from_suggestion=${s.id}`}>Open</Link>
                </Button>
              ) : null}
              <RejectSuggestionButton id={s.id} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
