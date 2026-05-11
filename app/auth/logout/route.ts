import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  const { origin } = new URL(request.url)
  // 303 makes the browser switch from POST to GET when following the redirect.
  return NextResponse.redirect(`${origin}/`, { status: 303 })
}
