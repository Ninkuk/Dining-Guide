'use client'

import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight, Search, SlidersHorizontal, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { getCuisineEmoji } from '@/lib/cuisines'
import { cn } from '@/lib/utils'
import type { Facets, SortKey } from '@/components/RestaurantList'

const RATING_OPTIONS = [
  { value: '5', label: '★★★★★' },
  { value: '4', label: '★★★★☆' },
  { value: '3', label: '★★★☆☆' },
  { value: '2', label: '★★☆☆☆' },
  { value: '1', label: '★☆☆☆☆' },
  { value: 'unrated', label: 'Unrated' },
] as const

const VEGETARIAN_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'unknown', label: 'Unknown' },
] as const

const WALLET_OPTIONS = [
  { value: 'Cheap', label: 'Cheap' },
  { value: 'Normal', label: 'Normal' },
  { value: 'Splurge', label: 'Splurge' },
  { value: 'Big night', label: 'Big night' },
] as const

const STATUS_OPTIONS = [
  { value: 'visited', label: 'Visited' },
  { value: 'want_to_try', label: 'Want to try' },
  { value: 'permanently_closed', label: 'Permanently closed' },
] as const

const SORT_OPTIONS: ReadonlyArray<{ value: SortKey; label: string }> = [
  { value: 'rating-desc', label: 'Highest rating' },
  { value: 'name', label: 'Name' },
  { value: 'recent', label: 'Recently added' },
  { value: 'recent-visited', label: 'Recently visited' },
]

type FilterPanelProps = {
  facets: Facets
  search: string
  onSearchChange: (value: string) => void
  cuisines: string[]
  onCuisinesChange: (value: string[]) => void
  cities: string[]
  onCitiesChange: (value: string[]) => void
  ratings: string[]
  onRatingsChange: (value: string[]) => void
  occasions: string[]
  onOccasionsChange: (value: string[]) => void
  wallets: string[]
  onWalletsChange: (value: string[]) => void
  vegetarians: string[]
  onVegetariansChange: (value: string[]) => void
  statuses: string[]
  onStatusesChange: (value: string[]) => void
  sort: SortKey
  onSortChange: (value: SortKey) => void
  hasActiveFilters: boolean
  activeFilterCount: number
  onClearAll: () => void
  totalCount: number
  filteredCount: number
}

export function FilterPanel(props: FilterPanelProps) {
  const {
    facets,
    search,
    onSearchChange,
    cuisines,
    onCuisinesChange,
    cities,
    onCitiesChange,
    ratings,
    onRatingsChange,
    occasions,
    onOccasionsChange,
    wallets,
    onWalletsChange,
    vegetarians,
    onVegetariansChange,
    statuses,
    onStatusesChange,
    sort,
    onSortChange,
    hasActiveFilters,
    activeFilterCount,
    onClearAll,
    totalCount,
    filteredCount,
  } = props

  const cuisineOptions = facets.cuisines.map((c) => ({
    value: c,
    label: `${getCuisineEmoji(c)} ${c}`,
  }))
  const cityOptions = facets.cities.map((c) => ({ value: c, label: c }))
  const occasionOptions = facets.occasions.map((o) => ({ value: o, label: o }))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <InputGroup className="min-w-0 flex-1 sm:max-w-sm">
          <InputGroupAddon>
            <Search className="size-4" />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by name…"
            aria-label="Search restaurants by name"
          />
          {search ? (
            <InputGroupAddon align="inline-end">
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="rounded-full text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="size-4" />
              </button>
            </InputGroupAddon>
          ) : null}
        </InputGroup>

        {/* Mobile: everything collapses into a drawer */}
        <Drawer>
          <DrawerTrigger asChild>
            <Button variant="outline" size="sm" className="shrink-0 gap-1.5 md:hidden">
              <SlidersHorizontal className="size-4" />
              Filters
              {activeFilterCount > 0 ? (
                <Badge variant="secondary" className="ml-0.5">
                  {activeFilterCount}
                </Badge>
              ) : null}
            </Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Filters & sort</DrawerTitle>
              <DrawerDescription>
                Showing {filteredCount} of {totalCount}
              </DrawerDescription>
            </DrawerHeader>

            <div className="flex flex-col divide-y divide-border/40 overflow-y-auto px-4">
              <DrawerSortGroup sort={sort} onSortChange={onSortChange} />
              <CheckboxFilterGroup
                label="Cuisine"
                selected={cuisines}
                onChange={onCuisinesChange}
                options={cuisineOptions}
              />
              <CheckboxFilterGroup
                label="City"
                selected={cities}
                onChange={onCitiesChange}
                options={cityOptions}
              />
              <CheckboxFilterGroup
                label="Rating"
                selected={ratings}
                onChange={onRatingsChange}
                options={[...RATING_OPTIONS]}
              />
              <CheckboxFilterGroup
                label="Vegetarian"
                selected={vegetarians}
                onChange={onVegetariansChange}
                options={[...VEGETARIAN_OPTIONS]}
              />
              <CheckboxFilterGroup
                label="Status"
                selected={statuses}
                onChange={onStatusesChange}
                options={[...STATUS_OPTIONS]}
              />
              <CheckboxFilterGroup
                label="Wallet"
                selected={wallets}
                onChange={onWalletsChange}
                options={[...WALLET_OPTIONS]}
              />
              {occasionOptions.length > 0 ? (
                <CheckboxFilterGroup
                  label="Occasion"
                  selected={occasions}
                  onChange={onOccasionsChange}
                  options={occasionOptions}
                />
              ) : null}
            </div>

            <DrawerFooter className="flex-row gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={onClearAll}
                disabled={!hasActiveFilters}
              >
                Clear all
              </Button>
              <DrawerClose asChild>
                <Button className="flex-1">Show {filteredCount}</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>

      {/* Desktop: inline dropdown filters */}
      <div className="hidden flex-wrap items-center gap-2 md:flex">
        <MultiFilter
          label="Cuisine"
          selected={cuisines}
          onChange={onCuisinesChange}
          options={cuisineOptions}
          emptyHint="No cuisines yet"
        />
        <MultiFilter
          label="City"
          selected={cities}
          onChange={onCitiesChange}
          options={cityOptions}
          emptyHint="No cities yet"
        />
        <MultiFilter
          label="Rating"
          selected={ratings}
          onChange={onRatingsChange}
          options={[...RATING_OPTIONS]}
        />
        <MultiFilter
          label="Vegetarian"
          selected={vegetarians}
          onChange={onVegetariansChange}
          options={[...VEGETARIAN_OPTIONS]}
        />
        <MultiFilter
          label="Status"
          selected={statuses}
          onChange={onStatusesChange}
          options={[...STATUS_OPTIONS]}
        />
        <MultiFilter
          label="Wallet"
          selected={wallets}
          onChange={onWalletsChange}
          options={[...WALLET_OPTIONS]}
        />
        {occasionOptions.length > 0 ? (
          <MultiFilter
            label="Occasion"
            selected={occasions}
            onChange={onOccasionsChange}
            options={occasionOptions}
          />
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              Sort: {SORT_OPTIONS.find((o) => o.value === sort)?.label}
              <ChevronDown className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel>Sort by</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={sort}
              onValueChange={(v) => onSortChange(v as SortKey)}
            >
              {SORT_OPTIONS.map((o) => (
                <DropdownMenuRadioItem key={o.value} value={o.value}>
                  {o.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {hasActiveFilters ? (
          <Button variant="ghost" size="sm" onClick={onClearAll}>
            Clear all
          </Button>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {filteredCount} of {totalCount}
      </p>
    </div>
  )
}

type Option = { value: string; label: string }

function toggleValue(selected: string[], value: string, checked: boolean): string[] {
  return checked ? [...selected, value] : selected.filter((v) => v !== value)
}

function CollapsibleSection({
  label,
  count,
  defaultOpen = false,
  onClear,
  children,
}: {
  label: string
  count: number
  defaultOpen?: boolean
  onClear?: () => void
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="py-2">
      <div className="flex items-center gap-2">
        <CollapsibleTrigger className="flex flex-1 items-center gap-1.5 py-1 text-left">
          <ChevronRight
            className={cn(
              'size-3.5 shrink-0 text-muted-foreground transition-transform',
              open && 'rotate-90'
            )}
          />
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          {count > 0 ? (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium leading-none text-foreground">
              {count}
            </span>
          ) : null}
        </CollapsibleTrigger>
        {count > 0 && onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        ) : null}
      </div>
      <CollapsibleContent className="flex flex-col pt-1">{children}</CollapsibleContent>
    </Collapsible>
  )
}

function DrawerSortGroup({
  sort,
  onSortChange,
}: {
  sort: SortKey
  onSortChange: (value: SortKey) => void
}) {
  return (
    <CollapsibleSection label="Sort by" count={0} defaultOpen>
      <RadioGroup
        value={sort}
        onValueChange={(v) => onSortChange(v as SortKey)}
        className="gap-0 pl-5"
      >
        {SORT_OPTIONS.map((o) => (
          <label
            key={o.value}
            className="flex cursor-pointer items-center gap-2.5 rounded-lg py-1.5"
          >
            <RadioGroupItem value={o.value} />
            <span className="text-sm">{o.label}</span>
          </label>
        ))}
      </RadioGroup>
    </CollapsibleSection>
  )
}

function CheckboxFilterGroup({
  label,
  selected,
  onChange,
  options,
}: {
  label: string
  selected: string[]
  onChange: (value: string[]) => void
  options: ReadonlyArray<Option>
}) {
  if (options.length === 0) return null
  const selectedSet = new Set(selected)

  return (
    <CollapsibleSection
      label={label}
      count={selected.length}
      defaultOpen={selected.length > 0}
      onClear={() => onChange([])}
    >
      <div className="flex flex-col pl-5">
        {options.map((opt) => (
          <label
            key={opt.value}
            className="flex cursor-pointer items-center gap-2.5 rounded-lg py-1.5"
          >
            <Checkbox
              checked={selectedSet.has(opt.value)}
              onCheckedChange={(checked) =>
                onChange(toggleValue(selected, opt.value, checked === true))
              }
            />
            <span className="text-sm">{opt.label}</span>
          </label>
        ))}
      </div>
    </CollapsibleSection>
  )
}

function MultiFilter({
  label,
  selected,
  onChange,
  options,
  emptyHint,
}: {
  label: string
  selected: string[]
  onChange: (value: string[]) => void
  options: ReadonlyArray<Option>
  emptyHint?: string
}) {
  const isEmpty = options.length === 0
  const selectedSet = new Set(selected)
  const buttonLabel =
    selected.length === 0
      ? label
      : selected.length === 1
        ? `${label}: ${formatLabel(options, selected[0])}`
        : `${label} (${selected.length})`

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn('gap-1', selected.length > 0 && 'border-foreground/30 bg-input/60')}
          disabled={isEmpty}
        >
          {buttonLabel}
          <ChevronDown className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 w-56 overflow-y-auto">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        {isEmpty ? (
          <p className="px-2 py-1 text-xs text-muted-foreground">
            {emptyHint ?? 'No options'}
          </p>
        ) : (
          <>
            {options.map((opt) => (
              <DropdownMenuCheckboxItem
                key={opt.value}
                checked={selectedSet.has(opt.value)}
                onCheckedChange={(checked) =>
                  onChange(toggleValue(selected, opt.value, checked))
                }
                onSelect={(e) => e.preventDefault()}
              >
                {opt.label}
              </DropdownMenuCheckboxItem>
            ))}
            {selected.length > 0 ? (
              <>
                <DropdownMenuSeparator />
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="w-full px-2 py-1.5 text-left text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear {label.toLowerCase()}
                </button>
              </>
            ) : null}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function formatLabel(options: ReadonlyArray<Option>, value: string): string {
  return options.find((o) => o.value === value)?.label ?? value
}
