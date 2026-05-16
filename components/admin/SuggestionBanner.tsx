// Identifies a Suggestion being reviewed inside the pre-filled edit/new form
// per ADR-0002. Render directly above the form. Server component — passes the
// Reject button (client) as a prop-style child.
//
// Corrections receive `diffChips` (computed by the page via merge/diffCorrection
// + formatDiffChip) so the admin can see exactly which fields the proposal
// changes. The optional `baseStaleSince` triggers a stale-base warning when
// the live Restaurant has moved on since the submitter snapshotted it.

import Link from "next/link";
import { RejectSuggestionButton } from "@/components/admin/RejectSuggestionButton";
import type { DiffChip } from "@/lib/suggestions/diff-chips";

export function SuggestionBanner({
  id,
  kind,
  submitterName,
  anythingElse,
  diffChips,
  baseStaleSince,
}: {
  id: number;
  kind: "tip" | "correction";
  submitterName: string;
  anythingElse: string | null;
  /** Pre-computed diff chips. Tips pass nothing; Corrections pass an array. */
  diffChips?: DiffChip[];
  /**
   * ISO timestamp of the live Restaurant's `updated_at`, only when it is newer
   * than the Suggestion's `base_updated_at`. `undefined` means no warning.
   */
  baseStaleSince?: string;
}) {
  const kindLabel = kind === "tip" ? "Tip" : "Correction";
  return (
    <aside className="border-foreground/10 bg-muted/40 flex flex-col gap-3 rounded-2xl border p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
          Reviewing a {kindLabel.toLowerCase()} from{" "}
          <span className="text-foreground">{submitterName}</span>
        </p>
        <div className="flex items-center gap-1">
          <Link
            href="/suggestions"
            className="text-muted-foreground hover:text-foreground rounded px-2 py-1 text-xs underline-offset-4 hover:underline"
          >
            Discard suggestion
          </Link>
          <RejectSuggestionButton id={id} />
        </div>
      </div>

      {baseStaleSince ? (
        <p className="rounded-md border border-dashed border-amber-500/50 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          <span aria-hidden>⚠ </span>
          Base updated since submit · {relativeSince(baseStaleSince)}. The values below already
          reflect your edits; the proposal may now be partly redundant.
        </p>
      ) : null}

      {diffChips && diffChips.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {diffChips.map((c) => (
            <li
              key={c.label}
              className="bg-card text-muted-foreground ring-foreground/10 inline-flex items-baseline gap-1.5 rounded-full px-2.5 py-0.5 text-xs ring-1"
            >
              <span className="font-mono text-[10px] tracking-wide uppercase">{c.label}</span>
              <span className="text-foreground/90">{c.detail}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {anythingElse ? (
        <p className="text-muted-foreground text-sm leading-relaxed">
          <span className="text-muted-foreground/70 mr-1.5 text-xs font-medium tracking-[0.18em] uppercase">
            Note
          </span>
          &ldquo;{anythingElse}&rdquo;
        </p>
      ) : null}
      <p className="text-muted-foreground/70 text-[11px]">
        Saving the form below applies the change and marks this {kindLabel.toLowerCase()} accepted.
        Discard returns to the queue without changing anything.
      </p>
    </aside>
  );
}

function relativeSince(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diffSec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`;
  if (diffSec < 86_400) return `${Math.round(diffSec / 3600)}h ago`;
  return `${Math.round(diffSec / 86_400)}d ago`;
}
