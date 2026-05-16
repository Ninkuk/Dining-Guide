// Structured logging for blocked anonymous requests (ADR-0003).
//
// Lines land in Vercel function logs as JSON — searchable, no dashboard.
// The shape is fixed: changes here ripple into anyone grepping logs.
//
//   { event, reason, ip, ts, ...optional }
//
// `event` identifies the source (Suggestion submit vs. geocode proxy).
// `reason` is the canonical block reason from the spam stack. Optional
// fields can carry useful context (which Suggestion kind, which Zod path).

export type BlockedEvent = "submission_blocked" | "geocode_blocked";

export type BlockedReason = "preview_env" | "honeypot" | "botid" | "rate_limit" | "zod";

export function logBlocked(
  event: BlockedEvent,
  params: {
    reason: BlockedReason;
    ip: string;
    /** Suggestion kind when the event is a submission. */
    suggestion_kind?: "correction" | "tip" | "unknown";
    /** Optional human-readable context (Zod path, BotID classification, etc.). */
    detail?: string;
  },
): void {
  console.warn(
    JSON.stringify({
      event,
      reason: params.reason,
      ip: params.ip,
      ts: new Date().toISOString(),
      ...(params.suggestion_kind ? { suggestion_kind: params.suggestion_kind } : {}),
      ...(params.detail ? { detail: params.detail } : {}),
    }),
  );
}

/**
 * Map spam-stack `GuardReason` (plus a literal `preview`) into the canonical
 * `BlockedReason` set logged in the structured warning.
 */
export function guardReasonToBlockedReason(
  reason: "honeypot" | "bot" | "rate_hour" | "rate_day" | "schema" | "preview",
): BlockedReason {
  switch (reason) {
    case "honeypot":
      return "honeypot";
    case "bot":
      return "botid";
    case "rate_hour":
    case "rate_day":
      return "rate_limit";
    case "schema":
      return "zod";
    case "preview":
      return "preview_env";
  }
}
