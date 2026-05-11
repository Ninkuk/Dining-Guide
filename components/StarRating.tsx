import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MAX_RATING } from '@/lib/rating'

type StarRatingProps = {
  value: number | null | undefined
  /** Pixel size for each star icon. */
  size?: number
  className?: string
  /** Hide the "Unrated" pill when value is null. */
  hideUnrated?: boolean
}

/**
 * Display-only star rating. The form input variant lives in a separate
 * component built in Phase 6.
 */
export function StarRating({
  value,
  size = 16,
  className,
  hideUnrated = false,
}: StarRatingProps) {
  if (value == null) {
    if (hideUnrated) return null
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground',
          className
        )}
      >
        Unrated
      </span>
    )
  }

  const filled = Math.max(0, Math.min(MAX_RATING, Math.round(value)))

  return (
    <div
      className={cn('inline-flex items-center gap-0.5', className)}
      role="img"
      aria-label={`${filled} out of ${MAX_RATING} stars`}
    >
      {Array.from({ length: MAX_RATING }, (_, i) => {
        const isFilled = i < filled
        return (
          <Star
            key={i}
            width={size}
            height={size}
            className={cn(
              isFilled ? 'fill-amber-400 text-amber-400' : 'fill-transparent text-muted-foreground/40'
            )}
            strokeWidth={1.5}
          />
        )
      })}
    </div>
  )
}
