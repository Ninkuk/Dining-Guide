// Per-IP rate limit for anonymous Suggestion submits and the geocode proxy.
//
// Two windows: 3/hour and 10/day (ADR-0003 / parent PRD). A `bump` records
// a new submission; a `check` reports whether the next one would be allowed.
// State is a list of submission timestamps per IP; old entries are pruned at
// check/bump time so the structure stays bounded.
//
// The module is parameterised over a tiny `RateLimitStore` interface so the
// HTTP layer can back it with whatever persistence makes sense — Vercel
// Runtime Cache in production, in-memory in tests. The pure-function shape
// keeps the rate-limit math testable with a fake clock.

export const HOUR_LIMIT = 3;
export const DAY_LIMIT = 10;

const HOUR_MS = 60 * 60 * 1_000;
const DAY_MS = 24 * 60 * 60 * 1_000;

export interface RateLimitStore {
  get(ip: string): Promise<number[]>;
  set(ip: string, timestamps: number[]): Promise<void>;
  now(): number;
}

export type CheckResult =
  | { ok: true; remainingHour: number; remainingDay: number }
  | { ok: false; reason: "hour" | "day"; remainingHour: number; remainingDay: number };

function prune(timestamps: number[], now: number): number[] {
  const cutoff = now - DAY_MS;
  return timestamps.filter((t) => t > cutoff);
}

function countAfter(timestamps: number[], cutoff: number): number {
  let n = 0;
  for (const t of timestamps) if (t > cutoff) n++;
  return n;
}

export async function checkLimit(ip: string, store: RateLimitStore): Promise<CheckResult> {
  const now = store.now();
  const all = prune(await store.get(ip), now);
  const inHour = countAfter(all, now - HOUR_MS);
  const inDay = all.length;
  const remainingHour = Math.max(0, HOUR_LIMIT - inHour);
  const remainingDay = Math.max(0, DAY_LIMIT - inDay);
  if (inHour >= HOUR_LIMIT) return { ok: false, reason: "hour", remainingHour, remainingDay };
  if (inDay >= DAY_LIMIT) return { ok: false, reason: "day", remainingHour, remainingDay };
  return { ok: true, remainingHour, remainingDay };
}

export async function bumpLimit(ip: string, store: RateLimitStore): Promise<void> {
  const now = store.now();
  const existing = prune(await store.get(ip), now);
  await store.set(ip, [...existing, now]);
}

/**
 * Test-only / dev-only store. Production wires `createRuntimeCacheStore` from
 * `rate-limit-runtime-cache.ts` (next-cache backed) at the HTTP layer.
 */
export function createInMemoryStore(nowFn: () => number = () => Date.now()): RateLimitStore {
  const data = new Map<string, number[]>();
  return {
    async get(ip) {
      return data.get(ip) ?? [];
    },
    async set(ip, timestamps) {
      data.set(ip, timestamps);
    },
    now: nowFn,
  };
}
