'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { hasNavigatedWithinApp } from '@/lib/app-navigation'

type BackLinkProps = {
  className?: string
  label?: string
  href?: string
  /**
   * When true, clicking does `router.back()` if the user reached this page from
   * within the app — restoring the previous view's scroll position and URL
   * state. Falls back to navigating to `href` on cold loads (or modified
   * clicks, so cmd-click still opens a new tab).
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
      onClick={(e) => {
        if (
          preferHistoryBack &&
          !e.metaKey &&
          !e.ctrlKey &&
          !e.shiftKey &&
          !e.altKey &&
          hasNavigatedWithinApp()
        ) {
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
