// The guard pipeline an anonymous Suggestion submit must pass through, in
// the exact order ADR-0003 specifies:
//
//   1. assertNotPreview   — throws on `VERCEL_ENV === 'preview'`
//   2. honeypot           — hidden field must be empty
//   3. BotID              — Vercel's bot verification
//   4. rate limit         — 3/hour, 10/day per IP
//   5. Zod parse          — strips off-whitelist fields, validates shape
//
// On success the rate counter is bumped (so blocked attempts don't burn it).
// On failure, the caller logs a structured warning with the returned `reason`.

import { suggestionSchema, type Suggestion, type SuggestionInput } from "./schema";
import { bumpLimit, checkLimit, type RateLimitStore } from "./rate-limit";

export type GuardReason = "honeypot" | "bot" | "rate_hour" | "rate_day" | "schema";

export type GuardContext = {
  ip: string;
  honeypot: string | null | undefined;
  isPreview: boolean;
  botCheck: () => Promise<boolean>;
  store: RateLimitStore;
};

export type GuardOutcome =
  | { ok: true; parsed: Suggestion }
  | { ok: false; reason: GuardReason; detail?: string };

export async function runSubmitGuards(
  input: SuggestionInput,
  ctx: GuardContext,
): Promise<GuardOutcome> {
  // Preview deploys throw — caller intercepts and 4xxs. This matches the
  // existing pattern in app/(admin)/_actions/restaurants.ts.
  if (ctx.isPreview) {
    throw new Error("Writes are disabled on preview deployments.");
  }

  // Honeypot — bots fill hidden fields; humans don't. Short-circuit so we
  // never hit BotID / rate-limit / Zod for an obvious bot.
  if (ctx.honeypot && ctx.honeypot.length > 0) {
    return { ok: false, reason: "honeypot" };
  }

  if (!(await ctx.botCheck())) {
    return { ok: false, reason: "bot" };
  }

  const limit = await checkLimit(ctx.ip, ctx.store);
  if (!limit.ok) {
    return { ok: false, reason: limit.reason === "hour" ? "rate_hour" : "rate_day" };
  }

  const parsed = suggestionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "schema",
      detail: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    };
  }

  await bumpLimit(ctx.ip, ctx.store);
  return { ok: true, parsed: parsed.data };
}
