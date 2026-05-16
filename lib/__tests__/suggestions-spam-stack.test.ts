import { describe, expect, it } from "vitest";
import { runSubmitGuards, type GuardContext } from "../suggestions/spam-stack";
import { createInMemoryStore } from "../suggestions/rate-limit";

function baseInput() {
  return {
    kind: "tip" as const,
    target_restaurant_id: null,
    submitter_name: "Alice",
    payload: { name: "Bianco" },
    anything_else: null,
    photo_path: null,
  };
}

function baseContext(overrides: Partial<GuardContext> = {}): GuardContext {
  return {
    ip: "1.1.1.1",
    honeypot: "",
    isPreview: false,
    botCheck: async () => true,
    store: createInMemoryStore(),
    ...overrides,
  };
}

describe("runSubmitGuards", () => {
  it("returns ok on the happy path", async () => {
    const r = await runSubmitGuards(baseInput(), baseContext());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.parsed.kind).toBe("tip");
  });

  it("throws when VERCEL_ENV is preview, regardless of other inputs", async () => {
    await expect(
      runSubmitGuards(baseInput(), baseContext({ isPreview: true, honeypot: "spam" })),
    ).rejects.toThrow(/preview/i);
  });

  it("short-circuits on the honeypot before BotID, rate-limit, or Zod", async () => {
    let botCalled = false;
    const r = await runSubmitGuards(
      baseInput(),
      baseContext({
        honeypot: "i am a bot",
        botCheck: async () => {
          botCalled = true;
          return true;
        },
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("honeypot");
    expect(botCalled).toBe(false);
  });

  it("rejects when BotID verification returns false", async () => {
    const r = await runSubmitGuards(baseInput(), baseContext({ botCheck: async () => false }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("bot");
  });

  it("rejects when the per-IP rate limit is exceeded", async () => {
    const store = createInMemoryStore();
    const ctx = baseContext({ store });
    // 3 hourly cap → 4th must fail.
    await runSubmitGuards(baseInput(), ctx);
    await runSubmitGuards(baseInput(), ctx);
    await runSubmitGuards(baseInput(), ctx);
    const r = await runSubmitGuards(baseInput(), ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("rate_hour");
  });

  it("rejects malformed payload at the Zod step", async () => {
    const bad = { ...baseInput(), submitter_name: "" };
    const r = await runSubmitGuards(bad, baseContext());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("schema");
  });

  it("bumps the rate-limit counter only on the success path", async () => {
    const store = createInMemoryStore();
    const ctx = baseContext({ store });
    // Failure path: honeypot blocks before rate-limit; counter must stay at 0.
    await runSubmitGuards(baseInput(), baseContext({ ...ctx, honeypot: "x" }));
    expect((await store.get("1.1.1.1")).length).toBe(0);
    // Success path: counter increments.
    const ok = await runSubmitGuards(baseInput(), ctx);
    expect(ok.ok).toBe(true);
    expect((await store.get("1.1.1.1")).length).toBe(1);
  });
});
