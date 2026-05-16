import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";

// Paths that require an authenticated admin (Decision 4).
// Patterns: `/new`, `/<slug>/edit`, and the Suggestion admin queue
// (`/suggestions` and sub-paths). The public submit routes — `/suggest`,
// `/<slug>/suggest` — are intentionally NOT guarded.
const WRITE_ROUTE_PATTERNS: readonly RegExp[] = [
  /^\/new\/?$/,
  /^\/[^/]+\/edit\/?$/,
  /^\/suggestions(\/.*)?$/,
];

function isWriteRoute(pathname: string): boolean {
  return WRITE_ROUTE_PATTERNS.some((re) => re.test(pathname));
}

/**
 * Refreshes the Supabase session cookie on every request. Only redirects to
 * /auth/login when the path is a write route (Decision 4 + spec §Auth Model).
 *
 * Per Supabase + @supabase/ssr docs: do not put any code between
 * `createServerClient` and `getClaims()` — a stray await can cause random
 * sign-outs.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims && isWriteRoute(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
