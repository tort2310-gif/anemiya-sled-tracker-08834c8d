import { describe, it, expect } from "vitest";
import { getRange, statusOf, ALL_LAB_KEYS } from "./ranges";

describe("getRange", () => {
  it("returns gender-specific ranges for hb", () => {
    expect(getRange("hb", "female")).toMatchObject({ min: 120, max: 160 });
    expect(getRange("hb", "male")).toMatchObject({ min: 130, max: 170 });
  });

  it("returns gender-specific ranges for ferritin and creatinine", () => {
    expect(getRange("ferritin", "female")).toMatchObject({ min: 12, max: 150 });
    expect(getRange("ferritin", "male")).toMatchObject({ min: 15, max: 200 });
    expect(getRange("creatinine", "female")).toMatchObject({ min: 44, max: 97 });
    expect(getRange("creatinine", "male")).toMatchObject({ min: 62, max: 115 });
  });

  it("returns the same range for both genders for mcv", () => {
    expect(getRange("mcv", "female")).toMatchObject({ min: 80, max: 100 });
    expect(getRange("mcv", "male")).toMatchObject({ min: 80, max: 100 });
  });

  it("has a range defined for every key in ALL_LAB_KEYS (no missing switch case)", () => {
    for (const key of ALL_LAB_KEYS) {
      expect(() => getRange(key, "female")).not.toThrow();
      expect(getRange(key, "female")).toBeTruthy();
    }
  });
});

describe("statusOf", () => {
  const r = { min: 10, max: 20, unit: "u", label: "L" };

  it("returns na for undefined, null-like, or NaN input", () => {
    expect(statusOf(undefined, r)).toBe("na");
    expect(statusOf(Number.NaN, r)).toBe("na");
  });

  it("returns low below the minimum, ok at/inside the boundaries, high above the maximum", () => {
    expect(statusOf(9.999, r)).toBe("low");
    expect(statusOf(10, r)).toBe("ok");
    expect(statusOf(15, r)).toBe("ok");
    expect(statusOf(20, r)).toBe("ok");
    expect(statusOf(20.001, r)).toBe("high");
  });
});
