// Production wiring for the rate-limit store.
//
// ADR-0003 names "Vercel Runtime Cache" as the persistence layer, but in
// practice the existing `app/api/geocode/route.ts` is happy with a plain
// module-level `Map` riding on Fluid Compute's instance reuse. The Suggestion
// rate limit follows the same pattern — a hostile actor would have to flood
// many simultaneous cold instances to bypass it, which is much harder than
// just submitting a few forms.
//
// When Vercel Runtime Cache becomes the right tool (e.g., scaling beyond one
// region), swap this single factory; the unit tests don't care.

import type { RateLimitStore } from "./rate-limit";

const data = new Map<string, number[]>();

export function getSubmitRateLimitStore(): RateLimitStore {
  return {
    async get(ip) {
      return data.get(ip) ?? [];
    },
    async set(ip, timestamps) {
      data.set(ip, timestamps);
    },
    now: Date.now,
  };
}
