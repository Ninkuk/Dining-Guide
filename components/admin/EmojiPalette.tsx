"use client";

// A small curated emoji picker for cuisines — food / drink / place glyphs only
// (see CUISINE_EMOJI_CHOICES), grouped and scrollable. No flags: cuisine emoji
// are always a dish or ingredient. Deliberately not a full Unicode picker so the
// cuisine vocabulary stays visually consistent.

import { cn } from "@/lib/utils";
import { CUISINE_EMOJI_CHOICES } from "@/lib/cuisines";

export function EmojiPalette({
  value,
  onSelect,
  className,
}: {
  value?: string;
  onSelect: (emoji: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("overflow-y-auto p-2", className)}>
      {CUISINE_EMOJI_CHOICES.map((group) => (
        <div key={group.label}>
          <p className="text-muted-foreground px-1 pt-2 pb-1 text-[11px] font-medium tracking-wide uppercase first:pt-0">
            {group.label}
          </p>
          <div className="grid grid-cols-8 gap-0.5 sm:grid-cols-10">
            {group.emojis.map((e) => (
              <button
                key={e}
                type="button"
                aria-label={`Use ${e}`}
                aria-pressed={value === e}
                onClick={() => onSelect(e)}
                className={cn(
                  "hover:bg-accent focus-visible:bg-accent flex aspect-square items-center justify-center rounded-md text-lg leading-none transition-colors focus-visible:outline-none",
                  value === e && "bg-accent ring-foreground/25 ring-1",
                )}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
