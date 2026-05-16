"use server";

// Anonymous Suggestion submit. The ONLY anonymous write path in this codebase.
//
// Trust posture and the layered defenses live in docs/adr/0003. This action
// composes the deep modules from lib/suggestions/: schema (Zod) + spam-stack
// (preview/honeypot/BotID/rate-limit/Zod) + store (rate-limit persistence) +
// log (structured warning on block).

import { createClient } from "@/lib/supabase/server";
import { getClientIp } from "@/lib/suggestions/ip";
import { logBlockedSubmit } from "@/lib/suggestions/log";
import { runSubmitGuards } from "@/lib/suggestions/spam-stack";
import { getSubmitRateLimitStore } from "@/lib/suggestions/store";
import type { SuggestionInput } from "@/lib/suggestions/schema";

export type SubmitResult = { ok: true } | { ok: false; error: string; reason?: string };

export async function submitSuggestion(input: unknown): Promise<SubmitResult> {
  const ip = await getClientIp();
  const kind = inferKind(input);

  let guarded;
  try {
    guarded = await runSubmitGuards(input as SuggestionInput, {
      ip,
      honeypot: extractHoneypot(input),
      isPreview: process.env.VERCEL_ENV === "preview",
      // BotID is wired in a later slice (issue #7). For now the check is a
      // permissive no-op so the rest of the stack functions end-to-end.
      botCheck: async () => true,
      store: getSubmitRateLimitStore(),
    });
  } catch (err) {
    logBlockedSubmit({ kind, reason: "preview", ip, detail: (err as Error).message });
    return { ok: false, error: "Submissions are disabled on preview deployments." };
  }

  if (!guarded.ok) {
    logBlockedSubmit({ kind, reason: guarded.reason, ip, detail: guarded.detail });
    return { ok: false, error: errorMessageFor(guarded.reason), reason: guarded.reason };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("suggestions").insert({
    kind: guarded.parsed.kind,
    target_restaurant_id: guarded.parsed.target_restaurant_id ?? null,
    submitter_name: guarded.parsed.submitter_name,
    payload: guarded.parsed.payload as never,
    anything_else: guarded.parsed.anything_else ?? null,
    photo_path: guarded.parsed.photo_path ?? null,
  });

  if (error) {
    console.error("submitSuggestion insert error:", error);
    return { ok: false, error: "Couldn't save your suggestion. Try again in a minute." };
  }

  return { ok: true };
}

function inferKind(input: unknown): "correction" | "tip" | "unknown" {
  if (input && typeof input === "object" && "kind" in input) {
    const k = input.kind;
    if (k === "correction" || k === "tip") return k;
  }
  return "unknown";
}

function extractHoneypot(input: unknown): string | null {
  if (!input || typeof input !== "object") return null;
  // The form ships an "_website" hidden field — name is generic so bots
  // recognise it. If filled, the submitter is almost certainly automated.
  return (input as Record<string, unknown>)._website as string | null;
}

function errorMessageFor(reason: string): string {
  switch (reason) {
    case "honeypot":
    case "bot":
      return "Submission blocked. If this is a mistake, try again from a different browser.";
    case "rate_hour":
      return "You've sent a few suggestions in the last hour — try again later.";
    case "rate_day":
      return "Daily submission cap reached — try again tomorrow.";
    case "schema":
      return "Some fields didn't validate. Check the form and try again.";
    default:
      return "Couldn't save your suggestion.";
  }
}
