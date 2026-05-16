// Structured logging for blocked Suggestion submits (ADR-0003).
// Searchable in Vercel function logs without standing up a dashboard.

import type { GuardReason } from "./spam-stack";

export function logBlockedSubmit(params: {
  kind: "correction" | "tip" | "unknown";
  reason: GuardReason | "preview";
  ip: string;
  detail?: string;
}): void {
  console.warn(
    JSON.stringify({
      event: "suggestion_submit_blocked",
      kind: params.kind,
      reason: params.reason,
      ip: params.ip,
      detail: params.detail,
      ts: new Date().toISOString(),
    }),
  );
}
