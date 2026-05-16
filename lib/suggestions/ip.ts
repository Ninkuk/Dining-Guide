// Best-effort client IP for rate-limit keying on Vercel.
//
// Vercel sets `x-forwarded-for` (caller chain, leftmost = real client) and
// `x-real-ip` on every request. In local dev neither is set — we fall back
// to a stable sentinel so the same dev keeps the same bucket.

import { headers } from "next/headers";

const DEV_FALLBACK_IP = "127.0.0.1";

export async function getClientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return h.get("x-real-ip") ?? DEV_FALLBACK_IP;
}
