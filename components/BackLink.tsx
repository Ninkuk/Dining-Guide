import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

type BackLinkProps = {
  className?: string
  label?: string
}

export function BackLink({ className, label = 'Restaurants' }: BackLinkProps) {
  return (
    <Link
      href="/"
      className={cn(
        'inline-flex w-fit items-center gap-1 rounded text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        className
      )}
    >
      <ArrowLeft className="size-3.5" strokeWidth={1.75} />
      {label}
    </Link>
  )
}
