"use client";

import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmojiPalette } from "@/components/admin/EmojiPalette";
import { toast } from "sonner";
import { createCuisine, cuisineUsage, deleteCuisine } from "@/app/(admin)/_actions/cuisines";
import { titleCase } from "@/lib/cuisines";

export type CuisineOption = { name: string; emoji: string };

type Usage = { count: number; sample: string[] };

export function CuisineCombobox({
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
  const [localOptions, setLocalOptions] = useState<CuisineOption[]>(options);

  // Mirror externally-controlled `options` if the parent ever re-fetches them.
  const [prevOptions, setPrevOptions] = useState(options);
  if (prevOptions !== options) {
    setPrevOptions(options);
    setLocalOptions(options);
  }

  // Delete-confirm state.
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [deleting, setDeleting] = useState(false);

  const lookup = new Map(localOptions.map((o) => [o.name.toLowerCase(), o]));
  const hasExact = !!lookup.get(query.trim().toLowerCase());

  function toggle(name: string) {
    if (value.includes(name)) onChange(value.filter((v) => v !== name));
    else onChange([...value, name]);
  }

  function remove(name: string) {
    onChange(value.filter((v) => v !== name));
  }

  async function openDelete(name: string) {
    setOpen(false);
    setPendingDelete(name);
    setUsage(null);
    try {
      setUsage(await cuisineUsage(name));
    } catch {
      setUsage({ count: 0, sample: [] }); // fall back to the plain confirm
    }
  }

  async function confirmDelete() {
    const name = pendingDelete;
    if (!name) return;
    setDeleting(true);
    const res = await deleteCuisine(name);
    setDeleting(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setLocalOptions((prev) => prev.filter((o) => o.name !== name));
    if (value.includes(name)) onChange(value.filter((v) => v !== name));
    const n = res.data?.untaggedFrom ?? 0;
    toast.success(
      n > 0
        ? `Deleted "${name}" — untagged ${n} restaurant${n === 1 ? "" : "s"}`
        : `Deleted "${name}"`,
    );
    setPendingDelete(null);
    setUsage(null);
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <div className="flex flex-wrap items-center gap-1.5">
          {value.length === 0 ? (
            <span className="text-muted-foreground text-xs">No cuisines selected</span>
          ) : null}
          {value.map((name) => {
            const opt = localOptions.find((o) => o.name === name);
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
              placeholder="Search or add cuisine…"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              <CommandEmpty>
                <div className="text-muted-foreground px-2 py-3 text-xs">No matches.</div>
              </CommandEmpty>
              <CommandGroup>
                {localOptions
                  .filter((o) =>
                    query.trim() === "" ? true : o.name.toLowerCase().includes(query.toLowerCase()),
                  )
                  .map((opt) => {
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
                        <button
                          type="button"
                          aria-label={`Delete ${opt.name}`}
                          className="text-muted-foreground/50 hover:text-destructive focus-visible:text-destructive shrink-0 rounded p-1 transition-colors focus-visible:outline-none"
                          onClick={(e) => {
                            e.stopPropagation();
                            void openDelete(opt.name);
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </CommandItem>
                    );
                  })}
              </CommandGroup>
              {query.trim().length > 0 && !hasExact ? (
                <CommandGroup heading="Create new">
                  <CreateCuisineDialog
                    initialName={query.trim()}
                    onCreated={(c) => {
                      setLocalOptions((prev) =>
                        [...prev, c].sort((a, b) => a.name.localeCompare(b.name)),
                      );
                      onChange([...value, c.name]);
                      setQuery("");
                      setOpen(false);
                    }}
                  />
                </CommandGroup>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <AlertDialog
        open={pendingDelete != null}
        onOpenChange={(o) => {
          if (!o) {
            setPendingDelete(null);
            setUsage(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{pendingDelete}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              {usage == null
                ? "Checking where it’s used…"
                : usage.count === 0
                  ? "No restaurants use this cuisine. This can’t be undone."
                  : `Used by ${usage.count} restaurant${usage.count === 1 ? "" : "s"} (${usage.sample.join(", ")}${usage.count > usage.sample.length ? ", …" : ""}). Deleting it removes the “${pendingDelete}” tag from all of them. This can’t be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting || usage == null}
              onClick={() => void confirmDelete()}
            >
              {deleting ? "Deleting…" : usage && usage.count > 0 ? "Delete & untag" : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function CreateCuisineDialog({
  initialName,
  onCreated,
}: {
  initialName: string;
  onCreated: (c: CuisineOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(() => titleCase(initialName));
  const [emoji, setEmoji] = useState("🍽️");
  const [pending, setPending] = useState(false);

  // When `initialName` changes (user retypes in the combobox), reset the name
  // field. Inline pattern rather than an effect to satisfy React Compiler.
  const [prevInitial, setPrevInitial] = useState(initialName);
  if (prevInitial !== initialName) {
    setPrevInitial(initialName);
    setName(titleCase(initialName));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const res = await createCuisine({ name, emoji });
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    onCreated(res.data!);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <CommandItem onSelect={() => setOpen(true)}>
          <Plus className="mr-2 size-4" />
          Create &ldquo;{titleCase(initialName)}&rdquo;
        </CommandItem>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New cuisine</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cuisine-name">Name</Label>
            <Input
              id="cuisine-name"
              value={name}
              onChange={(e) => setName(titleCase(e.target.value))}
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <Label>Emoji</Label>
              <span className="text-xl leading-none" aria-hidden>
                {emoji}
              </span>
            </div>
            <div className="overflow-hidden rounded-lg border">
              <EmojiPalette value={emoji} className="h-64" onSelect={setEmoji} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || name.trim().length === 0}>
              {pending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
