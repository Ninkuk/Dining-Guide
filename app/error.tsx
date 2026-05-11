'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <h1 className="text-lg font-medium">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">
        {error.message || 'Unexpected error.'}
      </p>
      {error.digest ? (
        <p className="text-xs text-muted-foreground/70">ref: {error.digest}</p>
      ) : null}
      <Button onClick={reset}>Try again</Button>
    </div>
  )
}
