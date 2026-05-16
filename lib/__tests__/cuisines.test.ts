import { describe, expect, it } from "vitest";
import {
  CUISINE_EMOJI,
  CUISINE_EMOJI_CHOICES,
  findUnknownCuisines,
  getCuisineEmoji,
  getKnownCuisines,
  titleCase,
} from "../cuisines";

describe("CUISINE_EMOJI", () => {
  it("contains a few well-known cuisines", () => {
    expect(CUISINE_EMOJI.Pizza).toBeDefined();
    expect(CUISINE_EMOJI.Italian).toBeDefined();
    expect(CUISINE_EMOJI.Mexican).toBeDefined();
  });

  it("every entry is a non-empty string", () => {
    for (const [name, emoji] of Object.entries(CUISINE_EMOJI)) {
      expect(name.length, `${name} key`).toBeGreaterThan(0);
      expect(emoji.length, `${name} emoji`).toBeGreaterThan(0);
    }
  });

  // Convention: a dish or ingredient, never a country flag. Flag emoji are pairs
  // of regional-indicator symbols (U+1F1E6–U+1F1FF).
  it("uses no country flags", () => {
    const REGIONAL_INDICATOR = /[\u{1F1E6}-\u{1F1FF}]/u;
    for (const [name, emoji] of Object.entries(CUISINE_EMOJI)) {
      expect(REGIONAL_INDICATOR.test(emoji), `${name} emoji`).toBe(false);
    }
  });
});

describe("getCuisineEmoji", () => {
  it("returns the mapped emoji for known names", () => {
    expect(getCuisineEmoji("Pizza")).toBe(CUISINE_EMOJI.Pizza);
  });

  it("falls back to 🍽️ for unknown names", () => {
    expect(getCuisineEmoji("Klingon")).toBe("🍽️");
  });

  it("is case-sensitive (matches the canonical DB form)", () => {
    expect(getCuisineEmoji("pizza")).toBe("🍽️");
    expect(getCuisineEmoji("Pizza")).not.toBe("🍽️");
  });
});

describe("findUnknownCuisines", () => {
  it("returns deduped, sorted list of cuisines not in the map", () => {
    expect(findUnknownCuisines(["Pizza", "Klingon", "Pizza", "Vulcan"])).toEqual([
      "Klingon",
      "Vulcan",
    ]);
  });

  it("returns empty when all are known", () => {
    expect(findUnknownCuisines(["Pizza", "Italian"])).toEqual([]);
  });
});

describe("getKnownCuisines", () => {
  it("returns the keys of CUISINE_EMOJI sorted alphabetically", () => {
    const sorted = [...Object.keys(CUISINE_EMOJI)].sort();
    expect(getKnownCuisines()).toEqual(sorted);
  });
});

describe("titleCase", () => {
  it("capitalizes the first letter of each word", () => {
    expect(titleCase("korean fried chicken")).toBe("Korean Fried Chicken");
    expect(titleCase("middle eastern")).toBe("Middle Eastern");
  });

  it("capitalizes both sides of a hyphen", () => {
    expect(titleCase("tex-mex")).toBe("Tex-Mex");
  });

  it("lowercases the rest of each word", () => {
    expect(titleCase("INDIAN")).toBe("Indian");
    expect(titleCase("iTALiAN")).toBe("Italian");
  });

  it("leaves canonical title-cased names unchanged", () => {
    for (const name of ["Korean", "Italian", "Middle Eastern", "Tex-Mex", "Ice Cream", "Thai"]) {
      expect(titleCase(name)).toBe(name);
    }
  });

  it("is idempotent", () => {
    for (const s of ["korean", "TEX-MEX", "middle eastern", "BBQ"]) {
      expect(titleCase(titleCase(s))).toBe(titleCase(s));
    }
  });
});

describe("CUISINE_EMOJI_CHOICES", () => {
  it("is a non-empty list of non-empty groups", () => {
    expect(CUISINE_EMOJI_CHOICES.length).toBeGreaterThan(0);
    for (const group of CUISINE_EMOJI_CHOICES) {
      expect(group.label.length, `${group.label} label`).toBeGreaterThan(0);
      expect(group.emojis.length, `${group.label} emojis`).toBeGreaterThan(0);
      for (const e of group.emojis) {
        expect(e.length, `${group.label} entry`).toBeGreaterThan(0);
      }
    }
  });

  it("offers no country flags (matches the dish/ingredient convention)", () => {
    const REGIONAL_INDICATOR = /[\u{1F1E6}-\u{1F1FF}]/u;
    for (const group of CUISINE_EMOJI_CHOICES) {
      for (const e of group.emojis) {
        expect(REGIONAL_INDICATOR.test(e), `${group.label} entry ${e}`).toBe(false);
      }
    }
  });
});
