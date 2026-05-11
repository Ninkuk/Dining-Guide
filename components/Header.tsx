import { Suspense } from 'react'
import Link from 'next/link'
import { LogIn, LogOut, Plus, UtensilsCrossed } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3 sm:gap-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium tracking-tight"
        >
          <UtensilsCrossed className="size-5" strokeWidth={1.75} />
          <span className="hidden sm:inline">Dining Guide</span>
        </Link>

        <nav aria-label="Primary" className="flex items-center gap-0.5 text-sm">
          <NavLink href="/">List</NavLink>
          <NavLink href="/map">Map</NavLink>
          <NavLink href="/stats">Stats</NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <Suspense fallback={<AdminSlotSkeleton />}>
            <AdminSlot />
          </Suspense>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}

function NavLink({
  href,
  children,
  className,
}: {
  href: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        'rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
        className
      )}
    >
      {children}
    </Link>
  )
}

/**
 * Auth-aware admin slot. Reads cookies via getClaims(), so it's dynamic — wrap
 * with <Suspense> at the call site so the static header shell can prerender.
 *
 * Spec §Caching & Rendering: "Auth-aware components are NOT inside 'use cache'
 * boundaries."
 */
async function AdminSlot() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const isAdmin = !!data?.claims

  if (!isAdmin) {
    return (
      <Button variant="ghost" size="sm" asChild>
        <Link href="/auth/login">
          <LogIn className="size-4" />
          <span className="hidden sm:inline">Sign in</span>
        </Link>
      </Button>
    )
  }

  return (
    <>
      <Button variant="default" size="sm" asChild>
        <Link href="/new">
          <Plus className="size-4" />
          <span className="hidden sm:inline">Add</span>
        </Link>
      </Button>
      <form action="/auth/logout" method="post">
        <Button
          type="submit"
          variant="ghost"
          size="icon"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="size-4" />
        </Button>
      </form>
    </>
  )
}

function AdminSlotSkeleton() {
  return <Skeleton className="h-8 w-20 rounded-full" />
}
