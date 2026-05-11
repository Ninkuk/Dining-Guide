'use server'

import { updateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { cuisineSchema } from '@/lib/schemas/cuisine'

type ActionResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

function assertNotPreview() {
  if (process.env.VERCEL_ENV === 'preview') {
    throw new Error('Writes are disabled on preview deployments.')
  }
}

async function assertAuthed() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims) {
    throw new Error('Unauthenticated')
  }
}

export async function createCuisine(
  input: unknown
): Promise<ActionResult<{ name: string; emoji: string }>> {
  assertNotPreview()
  await assertAuthed()

  const parsed = cuisineSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.message }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('cuisines')
    .insert({ name: parsed.data.name, emoji: parsed.data.emoji })
    .select()
    .single()

  if (error) {
    return { ok: false, error: error.message }
  }

  updateTag('cuisines')
  return { ok: true, data: { name: data.name, emoji: data.emoji } }
}
