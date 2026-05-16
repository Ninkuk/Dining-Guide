// Identifies a Suggestion being reviewed inside the pre-filled edit/new form
// per ADR-0002. Render directly above the form. Server component — passes the
// Reject button (client) as a prop-style child.

import Link from "next/link";
import { RejectSuggestionButton } from "@/components/admin/RejectSuggestionButton";

export function SuggestionBanner({
  id,
  kind,
  submitterName,
  anythingElse,
}: {
  id: number;
  kind: "tip" | "correction";
  submitterName: string;
  anythingElse: string | null;
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
