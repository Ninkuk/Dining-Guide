import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

type CompactStarProps = {
  rating: number | null
  className?: string
}

export function CompactStar({ rating, className }: CompactStarProps) {
  if (rating == null) {
    return (
      <span
        className={cn('font-mono text-muted-foreground tabular-nums', className)}
        aria-label="Unrated"
      >
        —
      </span>
    )
  }

  const safe = Math.max(1, Math.min(5, Math.round(rating)))

  return (
    <span
      className={cn('inline-flex items-center gap-1 font-mono tabular-nums', className)}
      aria-label={`${safe} out of 5 stars`}
    >
      <Star
        className="size-3.5 fill-amber-400 text-amber-400"
        strokeWidth={0}
        aria-hidden
      />
      <span>{safe}</span>
    </span>
  )
}
