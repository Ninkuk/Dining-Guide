// Server-side geocode proxy (Photon, via lib/geocode.ts).
//
// The browser hits this route from the address-autocomplete combobox. The
// route exists to (a) keep all geocoding behind one server module, (b) cache
// responses for 7 days in an in-memory map, and (c) gate anonymous callers
// behind the same per-IP rate limit and BotID check as the Suggestion submit
// path (ADR-0003) — anon Suggestion forms exercise this endpoint, so the cap
// applies here too.
//
// Fluid Compute reuses function instances, so the cache survives between
// invocations on the same instance — good enough for a single-admin app.

import { checkBotId } from "botid/server";
import { NextResponse } from "next/server";
import { geocodeAutocomplete } from "@/lib/geocode";
import { createClient } from "@/lib/supabase/server";
import { getClientIp } from "@/lib/suggestions/ip";
import { logBlocked } from "@/lib/suggestions/log";
import { bumpLimit, checkLimit } from "@/lib/suggestions/rate-limit";
import { getSubmitRateLimitStore } from "@/lib/suggestions/store";

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

type CacheEntry = { ts: number; value: unknown };
const cache = new Map<string, CacheEntry>();

function read(key: string): unknown | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function write(key: string, value: unknown): void {
  cache.set(key, { ts: Date.now(), value });
}

/** Accept a `minLon,minLat,maxLon,maxLat` viewbox; ignore anything malformed. */
function parseViewbox(raw: string | null): string | undefined {
  if (!raw) return undefined;
  const parts = raw.split(",");
  if (parts.length !== 4) return undefined;
  if (parts.some((p) => !Number.isFinite(Number(p)))) return undefined;
  return raw;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  if (!q || q.length < 3) {
    return NextResponse.json([], { status: 200 });
  }

  const viewbox = parseViewbox(url.searchParams.get("viewbox"));
  const key = `${q.toLowerCase()}|${viewbox ?? ""}`;
  const cached = read(key);
  if (cached) {
    // Cache hits skip the rate-limit and BotID check — they don't hit Photon,
    // they don't burn function-seconds, and they shouldn't ratchet the per-IP
    // counter against the user.
    return NextResponse.json(cached, { headers: { "x-cache": "hit" } });
  }

  // The admin uses this endpoint from the auth-gated /new and /[slug]/edit
  // forms — they should not be subject to the anon caps. The check is one
  // cookie-bound `getClaims` call, cheap on Fluid Compute.
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const isAuthed = !!claims?.claims;

  const ip = await getClientIp();
  const store = getSubmitRateLimitStore();

  if (!isAuthed) {
    const limit = await checkLimit(ip, store);
    if (!limit.ok) {
      logBlocked("geocode_blocked", { reason: "rate_limit", ip });
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const botResult = await checkBotId();
    if (botResult.isBot) {
      logBlocked("geocode_blocked", { reason: "botid", ip });
      return NextResponse.json({ error: "Request blocked" }, { status: 429 });
    }
  }

  try {
    const results = await geocodeAutocomplete(q, 5, viewbox);
    if (!isAuthed) await bumpLimit(ip, store);
    write(key, results);
    return NextResponse.json(results, { headers: { "x-cache": "miss" } });
  } catch (err) {
    console.error("geocode proxy failed:", err);
    return NextResponse.json({ error: "Geocode lookup failed" }, { status: 502 });
  }
}
