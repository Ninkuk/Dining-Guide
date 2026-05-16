"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Signs in with email + password. Signups are disabled in the Supabase
 * project (Decision 4), so only the pre-provisioned admin can authenticate.
 * On invalid credentials we surface a generic error to avoid leaking which
 * emails are valid.
 */
export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const nextRaw = String(formData.get("next") ?? "/").trim() || "/";
  const next = nextRaw.startsWith("/") ? nextRaw : "/";

  if (!email || !password) {
    redirect("/auth/login?error=missing-credentials");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error("signInWithPassword failed", error);
    redirect("/auth/login?error=invalid-credentials");
  }

  redirect(next);
}
