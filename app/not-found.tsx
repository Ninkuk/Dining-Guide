import Link from 'next/link'
import { BackLink } from '@/components/BackLink'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <BackLink className="self-start" />
      <h1 className="text-lg font-medium">Not found</h1>
      <p className="text-sm text-muted-foreground">
        No restaurant matches that URL.
      </p>
      <Button asChild>
        <Link href="/">Back to list</Link>
      </Button>
    </div>
  )
}
