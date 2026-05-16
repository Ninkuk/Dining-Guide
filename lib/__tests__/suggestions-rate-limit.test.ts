import { describe, expect, it } from "vitest";
import {
  createInMemoryStore,
  HOUR_LIMIT,
  DAY_LIMIT,
  checkLimit,
  bumpLimit,
  type RateLimitStore,
} from "../suggestions/rate-limit";

function freshStore(now = 0): { store: RateLimitStore; advance: (ms: number) => void } {
  let t = now;
  const store = createInMemoryStore(() => t);
  return { store, advance: (ms) => (t += ms) };
}

describe("checkLimit (happy path)", () => {
  it("returns ok with full remaining on a fresh ip", async () => {
    const { store } = freshStore();
    const r = await checkLimit("1.1.1.1", store);
    expect(r.ok).toBe(true);
    expect(r.remainingHour).toBe(HOUR_LIMIT);
    expect(r.remainingDay).toBe(DAY_LIMIT);
  });

  it("decrements remaining after each bump", async () => {
    const { store } = freshStore();
    await bumpLimit("1.1.1.1", store);
    const r = await checkLimit("1.1.1.1", store);
    expect(r.ok).toBe(true);
    expect(r.remainingHour).toBe(HOUR_LIMIT - 1);
    expect(r.remainingDay).toBe(DAY_LIMIT - 1);
  });

  it("isolates counters per ip", async () => {
    const { store } = freshStore();
    await bumpLimit("1.1.1.1", store);
    const r = await checkLimit("2.2.2.2", store);
    expect(r.remainingHour).toBe(HOUR_LIMIT);
  });
});

describe("hour-window enforcement", () => {
  it("blocks the (HOUR_LIMIT+1)th request within the hour", async () => {
    const { store } = freshStore();
    for (let i = 0; i < HOUR_LIMIT; i++) await bumpLimit("ip", store);
    const r = await checkLimit("ip", store);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("hour");
  });

  it("resets after the hour window expires", async () => {
    const { store, advance } = freshStore();
    for (let i = 0; i < HOUR_LIMIT; i++) await bumpLimit("ip", store);
    expect((await checkLimit("ip", store)).ok).toBe(false);
    advance(60 * 60 * 1_000 + 1);
    const r = await checkLimit("ip", store);
    expect(r.ok).toBe(true);
    expect(r.remainingHour).toBe(HOUR_LIMIT);
  });
});

describe("day-window enforcement", () => {
  it("blocks when the day cap is reached even if spread across hours", async () => {
    const { store, advance } = freshStore();
    for (let i = 0; i < HOUR_LIMIT; i++) await bumpLimit("ip", store);
    advance(60 * 60 * 1_000 + 1);
    for (let i = 0; i < HOUR_LIMIT; i++) await bumpLimit("ip", store);
    advance(60 * 60 * 1_000 + 1);
    for (let i = 0; i < HOUR_LIMIT; i++) await bumpLimit("ip", store);
    advance(60 * 60 * 1_000 + 1);
    for (let i = 0; i < HOUR_LIMIT - 1; i++) await bumpLimit("ip", store);
    // 3+3+3+2 = 11, but DAY_LIMIT is 10 so the 11th must reject.
    const r = await checkLimit("ip", store);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("day");
  });

  it("resets after the day window expires", async () => {
    const { store, advance } = freshStore();
    for (let i = 0; i < DAY_LIMIT; i++) await bumpLimit("ip", store);
    expect((await checkLimit("ip", store)).ok).toBe(false);
    advance(24 * 60 * 60 * 1_000 + 1);
    const r = await checkLimit("ip", store);
    expect(r.ok).toBe(true);
    expect(r.remainingDay).toBe(DAY_LIMIT);
  });
});

describe("constants", () => {
  it("matches ADR-0003 / parent PRD: 3/hour, 10/day", () => {
    expect(HOUR_LIMIT).toBe(3);
    expect(DAY_LIMIT).toBe(10);
  });
});
