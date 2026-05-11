'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

export function StarRatingInput({
  value,
  onChange,
}: {
  value: number | null
  onChange: (next: number | null) => void
}) {
  const [hover, setHover] = useState<number | null>(null)

  return (
    <div className="flex items-center gap-1" onMouseLeave={() => setHover(null)}>
      {[1, 2, 3, 4, 5].map((n) => {
        const isSet = value != null && n <= value
        const isHoverPreview = hover != null && n <= hover && !isSet
        return (
          <button
            key={n}
            type="button"
            aria-label={`Rate ${n} star${n === 1 ? '' : 's'}`}
            aria-pressed={isSet}
            className="rounded p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onMouseEnter={() => setHover(n)}
            onClick={() => onChange(value === n ? null : n)}
          >
            <Star
              className={cn(
                'size-6 transition-colors',
                isSet
                  ? 'fill-amber-400 stroke-amber-500'
                  : isHoverPreview
                    ? 'fill-amber-400/35 stroke-amber-500/60'
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
