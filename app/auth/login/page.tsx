import { Suspense } from 'react'
import { requestMagicLink } from '../_actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

type SearchParams = Promise<{
  sent?: string
  error?: string
  next?: string
}>

export default function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            We&rsquo;ll email you a magic link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<LoginFormSkeleton />}>
            <LoginFormDynamic searchParams={searchParams} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}

async function LoginFormDynamic({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { sent, error, next } = await searchParams

  if (sent) {
    return (
      <p className="text-sm text-muted-foreground">
        Check{' '}
        <span className="font-medium text-foreground">{sent}</span>{' '}
        for a sign-in link.
      </p>
    )
  }

  return (
    <form action={requestMagicLink} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next ?? '/'} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
        />
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit">Send magic link</Button>
    </form>
  )
}

function LoginFormSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-9 w-full" />
      </div>
      <Skeleton className="h-9 w-full" />
    </div>
  )
}
