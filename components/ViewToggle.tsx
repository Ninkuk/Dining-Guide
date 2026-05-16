"use client";

import { LayoutGrid, List, Map } from "lucide-react";
import { cn } from "@/lib/utils";

export type View = "cards" | "table" | "map";

type ViewToggleProps = {
  value: View;
  onChange: (v: View) => void;
};

const OPTIONS = [
  { value: "cards" as const, label: "Cards", Icon: LayoutGrid },
  { value: "table" as const, label: "Table", Icon: List },
  { value: "map" as const, label: "Map", Icon: Map },
];

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div className="flex justify-center">
      <div
        role="tablist"
        aria-label="Choose view"
        className="bg-card ring-foreground/10 inline-flex items-center gap-1 rounded-full p-1 ring-1"
      >
        {OPTIONS.map(({ value: v, label, Icon }) => {
          const active = value === v;
          return (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`view-panel-${v}`}
              onClick={() => onChange(v)}
              className={cn(
                "focus-visible:ring-ring/50 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2",
                active
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" strokeWidth={1.75} aria-hidden />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
