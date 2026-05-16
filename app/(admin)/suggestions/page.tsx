// Admin moderation queue for Suggestions. Auth-gated by the proxy
// (lib/supabase/proxy.ts adds /suggestions(/.*)? to its write-route patterns),
// so anonymous visitors get redirected to /auth/login.
//
// Default view shows pending only. `?show=rejected` widens the filter to
// pending + rejected so the admin can audit past decisions (issue #8).
// Accepted Suggestions deliberately stay out — they're already reflected in
// live data; the queue's job is the pending → decided transition.

import { Suspense } from "react";
import Link from "next/link";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
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

type SearchParams = { show?: string };

export default function SuggestionsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
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
          form; reject to dismiss. Toggle &ldquo;Show rejected&rdquo; to audit past decisions.
        </p>
      </header>
      <Suspense fallback={<Skeleton className="h-[280px] w-full rounded-2xl" />}>
        <Queue searchParams={searchParams} />
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

async function Queue({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const showRejected = params.show === "rejected";

  const supabase = await createClient();
  const query = supabase
    .from("suggestions")
    .select(
      "id, kind, status, target_restaurant_id, submitter_name, anything_else, created_at, decided_at, admin_note, payload, photo_path",
    )
    .order("created_at", { ascending: false });

  const { data, error } = await (showRejected
    ? query.in("status", ["pending", "rejected"])
    : query.eq("status", "pending"));

  if (error) {
    return (
      <div className="border-destructive/40 text-destructive rounded-2xl border p-6 text-sm">
        Couldn&rsquo;t load the queue: {error.message}
      </div>
    );
  }

  const rows = data ?? [];

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
    <div className="flex flex-col gap-4">
      <FilterToggle showRejected={showRejected} />
      {rows.length === 0 ? (
        <div className="border-border/60 text-muted-foreground rounded-2xl border border-dashed p-8 text-center text-sm">
          {showRejected ? "No pending or rejected items." : "Nothing pending. The queue is empty."}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((s) => {
            const target = s.target_restaurant_id ? targetsById.get(s.target_restaurant_id) : null;
            const chips =
              s.kind === "correction" && target
                ? diffCorrection(target, (s.payload ?? {}) as CorrectionPayload).map(formatDiffChip)
                : [];
            const isRejected = s.status === "rejected";
            return (
              <li
                key={s.id}
                className={cn(
                  "bg-card ring-foreground/10 hover:ring-foreground/20 flex flex-col gap-3 rounded-2xl p-5 ring-1 sm:flex-row sm:items-start sm:justify-between",
                  isRejected && "opacity-60",
                )}
              >
                <div className="flex min-w-0 flex-col gap-1.5">
                  <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                    <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 font-mono text-[10px] tracking-wide uppercase">
                      {s.kind}
                    </span>
                    {isRejected ? (
                      <span className="bg-muted text-muted-foreground/70 rounded-full px-2 py-0.5 font-mono text-[10px] tracking-wide uppercase">
                        rejected
                      </span>
                    ) : null}
                    <span>by {s.submitter_name}</span>
                    {s.photo_path ? (
                      <span
                        className="text-muted-foreground inline-flex items-center gap-0.5"
                        title="Photo attached"
                      >
                        <ImageIcon className="size-3" aria-hidden />
                      </span>
                    ) : null}
                    <span aria-hidden>·</span>
                    <span className="font-mono tabular-nums">
                      {formatRelativeFromNow(s.created_at)}
                    </span>
                    {isRejected && s.decided_at ? (
                      <>
                        <span aria-hidden>·</span>
                        <span className="font-mono tabular-nums">
                          decided {formatRelativeFromNow(s.decided_at)}
                        </span>
                      </>
                    ) : null}
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
                  {isRejected && s.admin_note ? (
                    <p className="text-muted-foreground/80 text-xs italic">
                      reason: {s.admin_note}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {!isRejected && s.kind === "tip" ? (
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/new?from_suggestion=${s.id}`}>Open</Link>
                    </Button>
                  ) : null}
                  {!isRejected && s.kind === "correction" && target ? (
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/${target.slug}/edit?from_suggestion=${s.id}`}>Open</Link>
                    </Button>
                  ) : null}
                  {!isRejected ? <RejectSuggestionButton id={s.id} /> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function FilterToggle({ showRejected }: { showRejected: boolean }) {
  return (
    <nav className="flex items-center gap-1 text-xs" aria-label="Queue filter">
      <FilterChip href="/suggestions" active={!showRejected}>
        Pending only
      </FilterChip>
      <FilterChip href="/suggestions?show=rejected" active={showRejected}>
        Show rejected
      </FilterChip>
    </nav>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "ring-foreground/10 hover:ring-foreground/20 rounded-full px-3 py-1 ring-1 transition-colors",
        active
          ? "bg-foreground text-background ring-foreground/30"
          : "bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
