import { describe, expect, it } from "vitest";
import { formatDiffChip } from "../suggestions/diff-chips";

describe("formatDiffChip — scalars", () => {
  it("formats a string field as 'field: old → new'", () => {
    expect(formatDiffChip({ field: "name", from: "Bianco", to: "Pizzeria Bianco" })).toEqual({
      label: "name",
      detail: "Bianco → Pizzeria Bianco",
    });
  });

  it("formats a boolean field as 'field: old → new' with booleans", () => {
    expect(formatDiffChip({ field: "permanently_closed", from: false, to: true })).toEqual({
      label: "permanently_closed",
      detail: "false → true",
    });
  });

  it("renders null as the literal '—' in scalar diffs", () => {
    expect(formatDiffChip({ field: "vegetarian", from: null, to: "yes" })).toEqual({
      label: "vegetarian",
      detail: "— → yes",
    });
    expect(formatDiffChip({ field: "name", from: "X", to: null })).toEqual({
      label: "name",
      detail: "X → —",
    });
  });
});

describe("formatDiffChip — cuisine[]", () => {
  it("renders a pure addition as '+X'", () => {
    expect(formatDiffChip({ field: "cuisine", from: ["Pizza"], to: ["Pizza", "Italian"] })).toEqual(
      { label: "cuisine", detail: "+Italian" },
    );
  });

  it("renders a pure removal as '−X'", () => {
    expect(formatDiffChip({ field: "cuisine", from: ["Pizza", "Italian"], to: ["Pizza"] })).toEqual(
      { label: "cuisine", detail: "−Italian" },
    );
  });

  it("combines additions and removals", () => {
    expect(
      formatDiffChip({ field: "cuisine", from: ["Pizza", "Italian"], to: ["Pizza", "Wood-fired"] }),
    ).toEqual({ label: "cuisine", detail: "+Wood-fired · −Italian" });
  });

  it("handles from being an empty array", () => {
    expect(formatDiffChip({ field: "cuisine", from: [], to: ["Pizza"] })).toEqual({
      label: "cuisine",
      detail: "+Pizza",
    });
  });
});

describe("formatDiffChip — locations[]", () => {
  it("collapses location-array diffs to a count summary", () => {
    expect(
      formatDiffChip({
        field: "locations",
        from: [{ city: "Phoenix", locality: null, address: null, latitude: null, longitude: null }],
        to: [
          { city: "Phoenix", locality: null, address: null, latitude: null, longitude: null },
          { city: "Tempe", locality: null, address: null, latitude: null, longitude: null },
        ],
      }),
    ).toEqual({ label: "locations", detail: "1 → 2 locations" });
  });

  it("singularises 1 location correctly", () => {
    expect(
      formatDiffChip({ field: "locations", from: [], to: [{ city: "Tempe" }] as never }),
    ).toEqual({ label: "locations", detail: "0 → 1 location" });
  });
});

describe("formatDiffChip — photo_url", () => {
  it("shows added when from is null", () => {
    const chip = formatDiffChip({
      field: "photo_url",
      from: null,
      to: "https://example.com/p.jpg",
    });
    expect(chip.label).toBe("photo_url");
    // We don't render the full URL — too long for a chip
    expect(chip.detail).toBe("added");
  });

  it("shows removed when to is null", () => {
    const chip = formatDiffChip({
      field: "photo_url",
      from: "https://example.com/p.jpg",
      to: null,
    });
    expect(chip.detail).toBe("removed");
  });

  it("shows replaced when both are non-null", () => {
    const chip = formatDiffChip({
      field: "photo_url",
      from: "https://example.com/p.jpg",
      to: "https://example.com/q.jpg",
    });
    expect(chip.detail).toBe("replaced");
  });
});
