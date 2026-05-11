'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function buildOrigin(headerList: Headers): string {
  // x-forwarded-* set by Vercel and most reverse proxies.
  const proto = headerList.get('x-forwarded-proto') ?? 'http'
  const host =
    headerList.get('x-forwarded-host') ??
    headerList.get('host') ??
    'localhost:3000'
  return `${proto}://${host}`
}

/**
 * Sends a magic link to the supplied email. With signups disabled in the
 * Supabase project, only the pre-provisioned admin can actually complete
 * sign-in (Decision 4) — for everyone else this is a no-op that still says
 * "we sent you an email" to avoid leaking which addresses are valid.
 */
export async function requestMagicLink(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const next = String(formData.get('next') ?? '/').trim() || '/'

  if (!email) {
    redirect('/auth/login?error=missing-email')
  }

  const supabase = await createClient()
  const headerList = await headers()
  const origin = buildOrigin(headerList)
  const callbackUrl = new URL('/auth/callback', origin)
  callbackUrl.searchParams.set('next', next)

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: callbackUrl.toString() },
  })

  if (error) {
    console.error('signInWithOtp failed', error)
    redirect(`/auth/login?error=${encodeURIComponent(error.message)}`)
  }

  redirect(`/auth/login?sent=${encodeURIComponent(email)}`)
}
