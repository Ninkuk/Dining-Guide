'use client'

import { useState } from 'react'
import { Check, ChevronsUpDown, Plus, X } from 'lucide-react'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { createCuisine } from '@/app/(admin)/_actions/cuisines'
import { cn } from '@/lib/utils'

export type CuisineOption = { name: string; emoji: string }

export function CuisineCombobox({
  options,
  value,
  onChange,
}: {
  options: CuisineOption[]
  value: string[]
  onChange: (next: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [localOptions, setLocalOptions] = useState<CuisineOption[]>(options)

  // Mirror externally-controlled `options` if the parent ever re-fetches them.
  const [prevOptions, setPrevOptions] = useState(options)
  if (prevOptions !== options) {
    setPrevOptions(options)
    setLocalOptions(options)
  }

  const lookup = new Map(localOptions.map((o) => [o.name.toLowerCase(), o]))
  const hasExact = !!lookup.get(query.trim().toLowerCase())

  function toggle(name: string) {
    if (value.includes(name)) onChange(value.filter((v) => v !== name))
    else onChange([...value, name])
  }

  function remove(name: string) {
    onChange(value.filter((v) => v !== name))
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {value.length === 0 ? (
          <span className="text-xs text-muted-foreground">No cuisines selected</span>
        ) : null}
        {value.map((name) => {
          const opt = localOptions.find((o) => o.name === name)
          return (
            <Badge key={name} variant="secondary" className="rounded-full pr-1">
              <span className="mr-1">{opt?.emoji ?? '🍽️'}</span>
              {name}
              <button
                type="button"
                aria-label={`Remove ${name}`}
                className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/10"
                onClick={() => remove(name)}
              >
                <X className="size-3" />
              </button>
            </Badge>
          )
        })}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="justify-between"
          >
            Add cuisine
            <ChevronsUpDown className="size-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search or add cuisine…"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              <CommandEmpty>
                <div className="px-2 py-3 text-xs text-muted-foreground">
                  No matches.
                </div>
              </CommandEmpty>
              <CommandGroup>
                {localOptions
                  .filter((o) =>
                    query.trim() === ''
                      ? true
                      : o.name.toLowerCase().includes(query.toLowerCase())
                  )
                  .map((opt) => {
                    const selected = value.includes(opt.name)
                    return (
                      <CommandItem
                        key={opt.name}
                        value={opt.name}
                        onSelect={() => toggle(opt.name)}
                      >
                        <Check
                          className={cn(
                            'mr-2 size-4',
                            selected ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        <span className="mr-2">{opt.emoji}</span>
                        {opt.name}
                      </CommandItem>
                    )
                  })}
              </CommandGroup>
              {query.trim().length > 0 && !hasExact ? (
                <CommandGroup heading="Create new">
                  <CreateCuisineDialog
                    initialName={query.trim()}
                    onCreated={(c) => {
                      setLocalOptions((prev) => [...prev, c].sort((a, b) => a.name.localeCompare(b.name)))
                      onChange([...value, c.name])
                      setQuery('')
                      setOpen(false)
                    }}
                  />
                </CommandGroup>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}

function CreateCuisineDialog({
  initialName,
  onCreated,
}: {
  initialName: string
  onCreated: (c: CuisineOption) => void
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(initialName)
  const [emoji, setEmoji] = useState('🍽️')
  const [pending, setPending] = useState(false)

  // When `initialName` changes (user retypes in the combobox), reset the name
  // field. Inline pattern rather than effect to satisfy React Compiler.
  const [prevInitial, setPrevInitial] = useState(initialName)
  if (prevInitial !== initialName) {
    setPrevInitial(initialName)
    setName(initialName)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    const res = await createCuisine({ name, emoji })
    setPending(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    onCreated(res.data!)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <CommandItem onSelect={() => setOpen(true)}>
          <Plus className="mr-2 size-4" />
          Create &ldquo;{initialName}&rdquo;
        </CommandItem>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New cuisine</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cuisine-name">Name</Label>
            <Input
              id="cuisine-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cuisine-emoji">Emoji</Label>
            <Input
              id="cuisine-emoji"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              maxLength={6}
              placeholder="🍽️"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || name.trim().length === 0}>
              {pending ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
