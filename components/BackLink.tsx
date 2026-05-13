'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getPreviousPath } from '@/lib/app-navigation'

type BackLinkProps = {
  className?: string
  label?: string
  href?: string
  /**
   * When true, an in-app click does `router.back()` instead of navigating to
   * `href` — but only when the previous page in this session *is* `href` (so
   * back() lands on the same place, with its scroll position / `?view=` /
   * filters restored). Otherwise, on a cold load, or on a modifier-click
   * (cmd-click → new tab — `onNavigate` doesn't fire), it's a plain link.
   */
  preferHistoryBack?: boolean
}

export function BackLink({
  className,
  label = 'Restaurants',
  href = '/',
  preferHistoryBack = false,
}: BackLinkProps) {
  const router = useRouter()

  return (
    <Link
      href={href}
      className={cn(
        'inline-flex w-fit items-center gap-1 rounded text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        className
      )}
      onNavigate={(e) => {
        if (preferHistoryBack && getPreviousPath() === href) {
          e.preventDefault()
          router.back()
        }
      }}
    >
      <ArrowLeft className="size-3.5" strokeWidth={1.75} />
      {label}
    </Link>
  )
}
