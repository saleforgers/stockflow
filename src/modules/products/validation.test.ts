import { describe, expect, it } from "vitest";

import { normalizeSpecifications, parseNonnegativeDecimal } from "./validation";

describe("product validation", () => {
  it("normalizes flexible specification keys without industry-specific fields", () => {
    expect(
      normalizeSpecifications([
        { key: " Material ", value: "Mild Steel" },
        { key: "Size / Grade", value: "8 ft / A" },
      ]),
    ).toEqual({ material: "Mild Steel", size_grade: "8 ft / A" });
  });

  it("rejects duplicate normalized specification keys and incomplete rows", () => {
    expect(() =>
      normalizeSpecifications([
        { key: "Quality Grade", value: "A" },
        { key: "quality-grade", value: "B" },
      ]),
    ).toThrow("Duplicate");
    expect(() => normalizeSpecifications([{ key: "Color", value: "" }])).toThrow("both");
  });

  it("parses prices with decimal safety and rejects negative or over-precision values", () => {
    expect(parseNonnegativeDecimal("001.2300", "Price", 4)).toBe("1.23");
    expect(parseNonnegativeDecimal("", "Price", 4)).toBeNull();
    expect(() => parseNonnegativeDecimal("-0.01", "Price", 4)).toThrow("negative");
    expect(() => parseNonnegativeDecimal("1.00001", "Price", 4)).toThrow("at most 4");
  });
});
