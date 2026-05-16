import { describe, expect, it } from "vitest";
import {
  CORRECTION_WHITELIST,
  correctionPayloadSchema,
  suggestionSchema,
  tipPayloadSchema,
} from "../suggestions/schema";

describe("CORRECTION_WHITELIST", () => {
  it("matches the seven fields ADR-0001 names as editable", () => {
    expect([...CORRECTION_WHITELIST]).toEqual([
      "name",
      "permanently_closed",
      "cuisine",
      "vegetarian",
      "locations",
      "photo_url",
      "anything_else",
    ]);
  });
});

describe("correctionPayloadSchema", () => {
  it("accepts a sparse payload — every field may be omitted", () => {
    const r = correctionPayloadSchema.safeParse({});
    expect(r.success).toBe(true);
  });

  it("strips fields outside the whitelist (editorial voice + personal context)", () => {
    const r = correctionPayloadSchema.parse({
      name: "Bianco Pizzeria",
      notes: "ignore me", // off-limits
      rating: 5, // off-limits
      occasion: "Fine Dine", // off-limits
      visited_at: "2026-05-01", // off-limits
      slug: "different-slug", // off-limits
      pros: "ignore", // off-limits
    });
    expect(r).toEqual({ name: "Bianco Pizzeria" });
    expect((r as Record<string, unknown>).notes).toBeUndefined();
    expect((r as Record<string, unknown>).rating).toBeUndefined();
  });

  it("accepts every whitelisted field at once", () => {
    const r = correctionPayloadSchema.parse({
      name: "Pizzeria Bianco",
      permanently_closed: true,
      cuisine: ["Pizza", "Italian"],
      vegetarian: "yes",
      locations: [{ city: "Phoenix", locality: null, address: null }],
      photo_url: null,
      anything_else: "moved last month",
    });
    expect(r.name).toBe("Pizzeria Bianco");
    expect(r.permanently_closed).toBe(true);
    expect(r.cuisine).toEqual(["Pizza", "Italian"]);
    expect(r.vegetarian).toBe("yes");
    expect(r.locations).toHaveLength(1);
    expect(r.anything_else).toBe("moved last month");
  });

  it("rejects a non-string name", () => {
    expect(correctionPayloadSchema.safeParse({ name: 123 }).success).toBe(false);
  });

  it("rejects vegetarian values outside yes/no", () => {
    expect(correctionPayloadSchema.safeParse({ vegetarian: "maybe" }).success).toBe(false);
  });

  it("trims empty strings on text fields to null where appropriate", () => {
    const r = correctionPayloadSchema.parse({ name: "  Bianco  " });
    expect(r.name).toBe("Bianco");
  });
});

describe("tipPayloadSchema", () => {
  it("requires a non-empty name", () => {
    const r1 = tipPayloadSchema.safeParse({ name: "" });
    expect(r1.success).toBe(false);
    const r2 = tipPayloadSchema.safeParse({ name: "Bianco" });
    expect(r2.success).toBe(true);
  });

  it("accepts the full Restaurant-like Tip shape (cuisines, vegetarian, locations)", () => {
    const r = tipPayloadSchema.parse({
      name: "New Spot",
      cuisine: ["Thai"],
      vegetarian: "no",
      permanently_closed: false,
      photo_url: null,
      locations: [
        { city: "Tempe", locality: "Mill Ave", address: null, latitude: null, longitude: null },
      ],
    });
    expect(r.name).toBe("New Spot");
    expect(r.cuisine).toEqual(["Thai"]);
    expect(r.locations[0].city).toBe("Tempe");
  });

  it("strips off-whitelist fields (notes/rating/occasion/wallet/etc.) — owner's voice", () => {
    const r = tipPayloadSchema.parse({
      name: "X",
      notes: "leaked",
      rating: 5,
      occasion: "Quick",
      wallet: "Cheap",
      status: "want_to_try",
      visited_at: "2026-01-01",
      pros: "leaked",
      cons: "leaked",
      recommendations: "leaked",
    });
    expect((r as Record<string, unknown>).notes).toBeUndefined();
    expect((r as Record<string, unknown>).rating).toBeUndefined();
    expect((r as Record<string, unknown>).occasion).toBeUndefined();
    expect((r as Record<string, unknown>).wallet).toBeUndefined();
    expect((r as Record<string, unknown>).status).toBeUndefined();
  });
});

describe("suggestionSchema (discriminated union)", () => {
  it("accepts a Correction with kind=correction and a target_restaurant_id", () => {
    const r = suggestionSchema.safeParse({
      kind: "correction",
      target_restaurant_id: 42,
      submitter_name: "Alice",
      payload: { name: "Bianco Pizzeria" },
      anything_else: null,
      photo_path: null,
    });
    expect(r.success).toBe(true);
  });

  it("rejects a Correction without target_restaurant_id", () => {
    const r = suggestionSchema.safeParse({
      kind: "correction",
      target_restaurant_id: null,
      submitter_name: "Alice",
      payload: {},
    });
    expect(r.success).toBe(false);
  });

  it("accepts a Tip with kind=tip and no target_restaurant_id", () => {
    const r = suggestionSchema.safeParse({
      kind: "tip",
      target_restaurant_id: null,
      submitter_name: "Bob",
      payload: { name: "A New Place" },
    });
    expect(r.success).toBe(true);
  });

  it("rejects a Tip that carries a target_restaurant_id", () => {
    const r = suggestionSchema.safeParse({
      kind: "tip",
      target_restaurant_id: 42,
      submitter_name: "Bob",
      payload: { name: "A New Place" },
    });
    expect(r.success).toBe(false);
  });

  it("rejects an empty submitter_name", () => {
    const r = suggestionSchema.safeParse({
      kind: "tip",
      target_restaurant_id: null,
      submitter_name: "  ",
      payload: { name: "X" },
    });
    expect(r.success).toBe(false);
  });

  it("rejects an unknown kind", () => {
    const r = suggestionSchema.safeParse({
      kind: "comment",
      target_restaurant_id: null,
      submitter_name: "A",
      payload: {},
    });
    expect(r.success).toBe(false);
  });

  it("caps anything_else at a reasonable length", () => {
    const huge = "x".repeat(5_001);
    const r = suggestionSchema.safeParse({
      kind: "tip",
      target_restaurant_id: null,
      submitter_name: "A",
      payload: { name: "X" },
      anything_else: huge,
    });
    expect(r.success).toBe(false);
  });
});
