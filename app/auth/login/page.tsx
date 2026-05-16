import { Suspense } from "react";
import { signIn } from "../_actions";
import { BackLink } from "@/components/BackLink";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type SearchParams = Promise<{
  error?: string;
  next?: string;
}>;

const ERROR_MESSAGES: Record<string, string> = {
  "missing-credentials": "Enter your email and password.",
  "invalid-credentials": "Invalid email or password.",
};

export const metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16">
      <BackLink className="self-start" />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Enter your email and password to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<LoginFormSkeleton />}>
            <LoginFormDynamic searchParams={searchParams} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}

async function LoginFormDynamic({ searchParams }: { searchParams: SearchParams }) {
  const { error, next } = await searchParams;
  const errorMessage = error ? (ERROR_MESSAGES[error] ?? "Sign-in failed.") : null;

  return (
    <form action={signIn} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next ?? "/"} />
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
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />
      </div>
      {errorMessage ? (
        <p className="text-destructive text-sm" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <Button type="submit">Sign in</Button>
    </form>
  );
}

function LoginFormSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-9 w-full" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-9 w-full" />
      </div>
      <Skeleton className="h-9 w-full" />
    </div>
  );
}
