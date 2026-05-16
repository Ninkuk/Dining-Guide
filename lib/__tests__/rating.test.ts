import { describe, expect, it } from "vitest";
import { intToStars, MAX_RATING, starsToInt } from "../rating";

describe("starsToInt", () => {
  it("counts filled stars", () => {
    expect(starsToInt("★")).toBe(1);
    expect(starsToInt("★★")).toBe(2);
    expect(starsToInt("★★★★★")).toBe(5);
  });

  it("returns null for the unrated convention (no filled stars)", () => {
    expect(starsToInt("☆☆☆☆☆")).toBeNull();
    expect(starsToInt("")).toBeNull();
    expect(starsToInt("   ")).toBeNull();
  });

  it("handles mixed filled and outlined", () => {
    expect(starsToInt("★★★☆☆")).toBe(3);
    expect(starsToInt("★☆★☆★")).toBe(3);
  });

  it("caps at MAX_RATING", () => {
    expect(starsToInt("★".repeat(10))).toBe(MAX_RATING);
  });
});

describe("intToStars", () => {
  it("renders n filled + (5-n) outlined", () => {
    expect(intToStars(0)).toBe("☆☆☆☆☆");
    expect(intToStars(3)).toBe("★★★☆☆");
    expect(intToStars(5)).toBe("★★★★★");
  });

  it("renders null/undefined as all outlined (unrated)", () => {
    expect(intToStars(null)).toBe("☆☆☆☆☆");
    expect(intToStars(undefined)).toBe("☆☆☆☆☆");
  });

  it("clamps out-of-range values", () => {
    expect(intToStars(-1)).toBe("☆☆☆☆☆");
    expect(intToStars(99)).toBe("★★★★★");
  });

  it("rounds non-integers", () => {
    expect(intToStars(2.7)).toBe("★★★☆☆");
  });

  it("is the inverse of starsToInt for non-null ratings", () => {
    for (let i = 1; i <= 5; i++) {
      expect(starsToInt(intToStars(i))).toBe(i);
    }
  });
});
