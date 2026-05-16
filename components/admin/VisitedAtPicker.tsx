"use client";

import { useState } from "react";
import { CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function fmt(date: Date | null): string {
  if (!date) return "";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  // Parse YYYY-MM-DD as a local calendar date. `new Date("YYYY-MM-DD")` would
  // interpret it as UTC midnight and shift the day in non-UTC timezones.
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isFinite(d.getTime()) ? d : null;
}

function toIsoDate(d: Date): string {
  // Build YYYY-MM-DD from local parts; `toISOString()` would convert to UTC
  // and shift the day for users east of UTC.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function VisitedAtPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const date = toDate(value);

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !date && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="mr-2 size-4" />
            {date ? fmt(date) : "Pick a date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date ?? undefined}
            defaultMonth={date ?? undefined}
            onSelect={(d) => {
              if (!d) return onChange(null);
              onChange(toIsoDate(d));
              setOpen(false);
            }}
            captionLayout="dropdown"
          />
        </PopoverContent>
      </Popover>
      {date ? (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Clear date"
          onClick={() => onChange(null)}
        >
          <X className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}
