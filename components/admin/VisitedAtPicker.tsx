"use client";

import { useState } from "react";
import { CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDateOnly, parseDateOnly, serializeDateOnly } from "@/lib/dates";
import { cn } from "@/lib/utils";

export function VisitedAtPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const date = parseDateOnly(value);

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
            {date ? formatDateOnly(date) : "Pick a date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date ?? undefined}
            defaultMonth={date ?? undefined}
            onSelect={(d) => {
              if (!d) return onChange(null);
              onChange(serializeDateOnly(d));
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
