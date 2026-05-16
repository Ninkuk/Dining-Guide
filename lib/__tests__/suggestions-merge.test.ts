import { describe, expect, it } from "vitest";
import { diffCorrection, mergeCorrection, mergeTip } from "../suggestions/merge";

type Live = Parameters<typeof mergeCorrection>[0];

const live: Live = {
  id: 7,
  slug: "bianco",
  name: "Bianco",
  cuisine: ["Pizza"],
  vegetarian: "no",
  permanently_closed: false,
  photo_url: "https://example.com/old.jpg",
  locations: [
    {
      id: 11,
      city: "Phoenix",
      locality: null,
      address: null,
      latitude: 33.45,
      longitude: -112.07,
    },
  ],
};

describe("mergeCorrection", () => {
  it("returns the live row unchanged when the payload is empty", () => {
    const out = mergeCorrection(live, {});
    expect(out).toEqual(live);
    expect(out).not.toBe(live);
  });

  it("overlays only the named fields (sparse merge)", () => {
    const out = mergeCorrection(live, { permanently_closed: true });
    expect(out.permanently_closed).toBe(true);
    expect(out.name).toBe("Bianco");
    expect(out.cuisine).toEqual(["Pizza"]);
  });

  it("treats undefined as 'no change' and null as 'clear'", () => {
    const out = mergeCorrection(live, { photo_url: null });
    expect(out.photo_url).toBeNull();
  });

  it("replaces array fields wholesale, not element-wise", () => {
    const out = mergeCorrection(live, { cuisine: ["Italian", "Wood-fired"] });
    expect(out.cuisine).toEqual(["Italian", "Wood-fired"]);
  });

  it("replaces locations with the proposed list", () => {
    const out = mergeCorrection(live, {
      locations: [
        { city: "Tempe", locality: null, address: null, latitude: null, longitude: null },
      ],
    });
    expect(out.locations).toHaveLength(1);
    expect(out.locations[0].city).toBe("Tempe");
  });

  it("does not mutate the input live row", () => {
    const snapshot = JSON.parse(JSON.stringify(live));
    mergeCorrection(live, { name: "Pizzeria Bianco" });
    expect(live).toEqual(snapshot);
  });
});

describe("mergeTip", () => {
  it("passes the Tip payload through unchanged (identity)", () => {
    const payload = {
      name: "New Spot",
      cuisine: ["Thai"],
      vegetarian: null,
      permanently_closed: false,
      photo_url: null,
      locations: [],
    };
    const out = mergeTip(payload);
    expect(out).toEqual(payload);
  });
});

describe("diffCorrection", () => {
  it("returns an empty list when no payload field differs from live", () => {
    expect(diffCorrection(live, {})).toEqual([]);
    expect(diffCorrection(live, { name: "Bianco" })).toEqual([]);
  });

  it("emits one entry per changed field with from/to", () => {
    const out = diffCorrection(live, {
      name: "Pizzeria Bianco",
      permanently_closed: true,
    });
    expect(out).toHaveLength(2);
    expect(out).toContainEqual({ field: "name", from: "Bianco", to: "Pizzeria Bianco" });
    expect(out).toContainEqual({ field: "permanently_closed", from: false, to: true });
  });

  it("treats array order as significant for cuisine", () => {
    const out = diffCorrection(live, { cuisine: ["Pizza", "Italian"] });
    expect(out).toHaveLength(1);
    expect(out[0].field).toBe("cuisine");
  });

  it("does not emit a diff for an undefined (sparse) field", () => {
    expect(diffCorrection(live, { name: undefined })).toEqual([]);
  });

  it("diff for locations is a single field-level entry, not per-row", () => {
    const out = diffCorrection(live, {
      locations: [
        { city: "Tempe", locality: null, address: null, latitude: null, longitude: null },
      ],
    });
    expect(out.filter((c) => c.field === "locations")).toHaveLength(1);
  });

  it("ignores anything_else — it's not a field-level change", () => {
    expect(diffCorrection(live, { anything_else: "moved last month" })).toEqual([]);
  });
});
