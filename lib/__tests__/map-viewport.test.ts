import { describe, expect, it } from "vitest";
import { restaurantInViewport, type BoundsLiteral } from "../map-viewport";

const TEMPE: BoundsLiteral = { north: 33.46, south: 33.36, east: -111.85, west: -111.99 };
const loc = (latitude: number | null, longitude: number | null) => ({ latitude, longitude });

describe("restaurantInViewport", () => {
  it("keeps a restaurant whose location is inside the box", () => {
    expect(restaurantInViewport([loc(33.41, -111.93)], TEMPE)).toBe(true);
  });
  it("drops a restaurant whose every location is outside the box", () => {
    expect(restaurantInViewport([loc(35.19, -111.65)], TEMPE)).toBe(false);
  });
  it("keeps a restaurant if any one of its locations is inside the box", () => {
    expect(restaurantInViewport([loc(35.19, -111.65), loc(33.42, -111.94)], TEMPE)).toBe(true);
  });
  it("keeps a restaurant with no geocoded location", () => {
    expect(restaurantInViewport([loc(null, null)], TEMPE)).toBe(true);
  });
  it("keeps an empty-locations restaurant", () => {
    expect(restaurantInViewport([], TEMPE)).toBe(true);
  });
  it("keeps everything when bounds is null", () => {
    expect(restaurantInViewport([loc(35.19, -111.65)], null)).toBe(true);
  });
  it("treats box edges as inside", () => {
    expect(restaurantInViewport([loc(33.46, -111.85)], TEMPE)).toBe(true);
  });
});
