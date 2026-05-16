import { describe, expect, it } from "vitest";
import { FORBIDDEN_SLUGS, isForbiddenSlug, isValidSlug, slugify } from "../slug";

describe("slugify", () => {
  it("lowercases and joins words with single dashes", () => {
    expect(slugify("Pizzeria Bianco")).toBe("pizzeria-bianco");
  });

  it("strips diacritics via NFKD", () => {
    expect(slugify("Café Crème")).toBe("cafe-creme");
    expect(slugify("Pâtisserie Élysée")).toBe("patisserie-elysee");
  });

  it("collapses runs of punctuation/whitespace", () => {
    expect(slugify("Joe   &   Sons -- Pizza!")).toBe("joe-sons-pizza");
    expect(slugify("  ___  Pizza  ___  ")).toBe("pizza");
  });

  it("drops apostrophes (no dash inserted)", () => {
    expect(slugify("Mama's Kitchen")).toBe("mama-s-kitchen");
  });

  it("handles ampersand and slashes uniformly", () => {
    expect(slugify("Surf & Turf / Phoenix")).toBe("surf-turf-phoenix");
  });

  it("returns empty string when input has no alphanumerics", () => {
    expect(slugify("---")).toBe("");
    expect(slugify("   ")).toBe("");
  });

  it("preserves digits", () => {
    expect(slugify("Cafe 51")).toBe("cafe-51");
  });

  it("produces strings that satisfy isValidSlug for normal names", () => {
    for (const name of ["Pizzeria Bianco", "Cafe 51", "Joe & Sons"]) {
      expect(isValidSlug(slugify(name))).toBe(true);
    }
  });
});

describe("FORBIDDEN_SLUGS / isForbiddenSlug", () => {
  it("matches the values pinned in the DB CHECK constraint", () => {
    expect([...FORBIDDEN_SLUGS]).toEqual(["map", "stats", "new", "api", "auth"]);
  });

  it("rejects each forbidden slug", () => {
    for (const s of FORBIDDEN_SLUGS) {
      expect(isForbiddenSlug(s)).toBe(true);
      expect(isValidSlug(s)).toBe(false);
    }
  });

  it("accepts well-formed non-forbidden slugs", () => {
    for (const s of ["pizzeria-bianco", "cafe-51", "joe", "a-b-c-d"]) {
      expect(isForbiddenSlug(s)).toBe(false);
      expect(isValidSlug(s)).toBe(true);
    }
  });
});

describe("isValidSlug regex", () => {
  it.each([
    ["", false],
    ["UPPER", false],
    ["has space", false],
    ["leading-", false],
    ["-trailing", false],
    ["double--dash", false],
    ["ok-1-2", true],
  ])("isValidSlug(%s) → %s", (slug, expected) => {
    expect(isValidSlug(slug)).toBe(expected);
  });
});
