'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { recordNavigation } from '@/lib/app-navigation'

/**
 * Records every client-side route change into the in-memory navigation trail
 * (see `lib/app-navigation`). Mounted once near the root so it observes all
 * navigations, including server-action `redirect()`s.
 */
export function NavigationTracker() {
  const pathname = usePathname()

  useEffect(() => {
    recordNavigation(pathname)
  }, [pathname])

  return null
}
