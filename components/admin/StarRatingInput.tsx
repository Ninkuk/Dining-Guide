'use client'

import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

export function StarRatingInput({
  value,
  onChange,
}: {
  value: number | null
  onChange: (next: number | null) => void
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = value != null && n <= value
        return (
          <button
            key={n}
            type="button"
            aria-label={`Rate ${n} star${n === 1 ? '' : 's'}`}
            aria-pressed={filled}
            className="rounded p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => onChange(value === n ? null : n)}
          >
            <Star
              className={cn(
                'size-6 transition-colors',
                filled
                  ? 'fill-amber-400 stroke-amber-500'
                  : 'fill-transparent stroke-muted-foreground'
              )}
              strokeWidth={1.5}
            />
          </button>
        )
      })}
      <button
        type="button"
        className="ml-2 text-xs text-muted-foreground underline-offset-2 hover:underline"
        onClick={() => onChange(null)}
      >
        Clear
      </button>
      <span className="ml-2 text-xs text-muted-foreground">
        {value == null ? 'Unrated' : `${value}/5`}
      </span>
    </div>
  )
}
