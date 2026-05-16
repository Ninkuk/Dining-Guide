"use server";

// Anonymous Suggestion submit. The ONLY anonymous write path in this codebase.
//
// Trust posture and the layered defenses live in docs/adr/0003. This action
// composes the deep modules from lib/suggestions/: schema (Zod) + spam-stack
// (preview/honeypot/BotID/rate-limit/Zod) + store (rate-limit persistence) +
// log (structured warning on block).

import { checkBotId } from "botid/server";
import { createClient } from "@/lib/supabase/server";
import { getClientIp } from "@/lib/suggestions/ip";
import { guardReasonToBlockedReason, logBlocked } from "@/lib/suggestions/log";
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
      // BotID lives at the same layer as the honeypot — both should fail
      // closed without leaking *why* to the submitter. `checkBotId` returns
      // `isBot: false` in local dev (NODE_ENV !== 'production') unless
      // `developmentOptions` is configured; real verification only runs on
      // Vercel-deployed environments.
      botCheck: async () => {
        const result = await checkBotId();
        return !result.isBot;
      },
      store: getSubmitRateLimitStore(),
    });
  } catch (err) {
    logBlocked("submission_blocked", {
      reason: "preview_env",
      ip,
      suggestion_kind: kind,
      detail: (err as Error).message,
    });
    return { ok: false, error: "Submissions are disabled on preview deployments." };
  }

  if (!guarded.ok) {
    logBlocked("submission_blocked", {
      reason: guardReasonToBlockedReason(guarded.reason),
      ip,
      suggestion_kind: kind,
      detail: guarded.detail,
    });
    return { ok: false, error: errorMessageFor(guarded.reason), reason: guarded.reason };
  }

  const supabase = await createClient();

  // For Corrections, snapshot the target restaurant's updated_at at submit
  // time. ADR-0003 uses this for the queue's "Base updated since submit"
  // warning. If the lookup fails we still insert; base_updated_at just stays
  // null and the admin doesn't see a stale-base warning for this one.
  let baseUpdatedAt: string | null = null;
  if (guarded.parsed.kind === "correction") {
    const { data: target } = await supabase
      .from("restaurants")
      .select("updated_at")
      .eq("id", guarded.parsed.target_restaurant_id)
      .maybeSingle();
    baseUpdatedAt = target?.updated_at ?? null;
  }

  const { error } = await supabase.from("suggestions").insert({
    kind: guarded.parsed.kind,
    target_restaurant_id: guarded.parsed.target_restaurant_id ?? null,
    submitter_name: guarded.parsed.submitter_name,
    payload: guarded.parsed.payload as never,
    anything_else: guarded.parsed.anything_else ?? null,
    photo_path: guarded.parsed.photo_path ?? null,
    base_updated_at: baseUpdatedAt,
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
