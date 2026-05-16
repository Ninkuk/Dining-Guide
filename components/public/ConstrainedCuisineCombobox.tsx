"use client";

// A trimmed-down CuisineCombobox for anonymous use. Reads from the same
// `cuisines` list as the admin combobox, but has no "Create new" branch —
// anon users can't write to `cuisines`. If they think one is missing, they
// mention it in the `anything_else` field; the admin canonicalises during the
// pre-filled accept form (per the PRD).

import { useState } from "react";
import { Plus, X } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { CuisineOption } from "@/components/admin/CuisineCombobox";

export function ConstrainedCuisineCombobox({
  options,
  value,
  onChange,
}: {
  options: CuisineOption[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  function toggle(name: string) {
    if (value.includes(name)) onChange(value.filter((v) => v !== name));
    else onChange([...value, name]);
  }

  function remove(name: string) {
    onChange(value.filter((v) => v !== name));
  }

  const filtered =
    query.trim() === ""
      ? options
      : options.filter((o) => o.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="flex flex-wrap items-center gap-1.5">
        {value.length === 0 ? (
          <span className="text-muted-foreground text-xs">No cuisines selected</span>
        ) : null}
        {value.map((name) => {
          const opt = options.find((o) => o.name === name);
          return (
            <Badge key={name} variant="secondary" className="rounded-full pr-1">
              <span className="mr-1">{opt?.emoji ?? "🍽️"}</span>
              {name}
              <button
                type="button"
                aria-label={`Remove ${name}`}
                className="hover:bg-muted-foreground/10 ml-1 rounded-full p-0.5"
                onClick={() => remove(name)}
              >
                <X className="size-3" />
              </button>
            </Badge>
          );
        })}
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            role="combobox"
            aria-expanded={open}
            className="rounded-full"
          >
            <Plus className="size-3.5" />
            add cuisine
          </Button>
        </PopoverTrigger>
      </div>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search cuisines…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              <div className="text-muted-foreground px-2 py-3 text-xs">
                No matches. Mention it in &ldquo;anything else&rdquo; — the admin will canonicalise.
              </div>
            </CommandEmpty>
            <CommandGroup>
              {filtered.map((opt) => {
                const selected = value.includes(opt.name);
                return (
                  <CommandItem
                    key={opt.name}
                    value={opt.name}
                    data-checked={selected ? "true" : undefined}
                    onSelect={() => toggle(opt.name)}
                  >
                    <span className="inline-flex w-6 shrink-0 items-center justify-center text-base leading-none">
                      {opt.emoji}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{opt.name}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
