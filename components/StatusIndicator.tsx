import { Bookmark, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Status = "visited" | "want_to_try" | string;

/**
 * Filled (visited) vs outlined (want_to_try) chip — paired visually with the
 * filled/outlined map markers so the same legend works everywhere.
 */
export function StatusIndicator({ status, className }: { status: Status; className?: string }) {
  if (status === "visited") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400",
          className,
        )}
      >
        <Check className="size-3" strokeWidth={2.5} />
        Visited
      </span>
    );
  }

  if (status === "want_to_try") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-dashed border-amber-500/50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400",
          className,
        )}
      >
        <Bookmark className="size-3" strokeWidth={2} />
        Want to try
      </span>
    );
  }

  return (
    <span
      className={cn(
        "bg-muted text-muted-foreground inline-flex items-center rounded-full px-2 py-0.5 text-xs",
        className,
      )}
    >
      {status}
    </span>
  );
}
