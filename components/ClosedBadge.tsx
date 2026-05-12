import { Ban } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * "Permanently closed" chip — a muted, slightly somber counterpart to
 * StatusIndicator. Shown alongside (not instead of) the status chip, since a
 * place can be both "visited" and closed.
 */
export function ClosedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground',
        className
      )}
    >
      <Ban className="size-3" strokeWidth={2} aria-hidden />
      Permanently closed
    </span>
  )
}
