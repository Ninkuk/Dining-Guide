import { Badge } from '@/components/ui/badge'
import { getCuisineEmoji } from '@/lib/cuisines'
import { cn } from '@/lib/utils'

export function CuisineBadge({
  name,
  className,
}: {
  name: string
  className?: string
}) {
  return (
    <Badge variant="secondary" className={cn('gap-1 font-normal', className)}>
      <span aria-hidden>{getCuisineEmoji(name)}</span>
      <span>{name}</span>
    </Badge>
  )
}
