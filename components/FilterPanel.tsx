'use client'

import { ChevronDown, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
  { value: 'name', label: 'Name' },
  { value: 'rating-desc', label: 'Highest rating' },
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
    onClearAll,
    totalCount,
    filteredCount,
  } = props

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="min-w-[12rem] flex-1 sm:max-w-sm">
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

        <MultiFilter
          label="Cuisine"
          selected={cuisines}
          onChange={onCuisinesChange}
          options={facets.cuisines.map((c) => ({
            value: c,
            label: `${getCuisineEmoji(c)} ${c}`,
          }))}
          emptyHint="No cuisines yet"
        />

        <MultiFilter
          label="City"
          selected={cities}
          onChange={onCitiesChange}
          options={facets.cities.map((c) => ({ value: c, label: c }))}
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

        {facets.occasions.length > 0 ? (
          <MultiFilter
            label="Occasion"
            selected={occasions}
            onChange={onOccasionsChange}
            options={facets.occasions.map((o) => ({ value: o, label: o }))}
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
                onCheckedChange={(checked) => {
                  if (checked) {
                    onChange([...selected, opt.value])
                  } else {
                    onChange(selected.filter((v) => v !== opt.value))
                  }
                }}
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
