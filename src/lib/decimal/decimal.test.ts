import { describe, expect, it } from "vitest";

import { ApplicationError } from "@/lib/errors/application-error";

import { roundMoney, serializeDecimal, validateQuantity } from "./decimal";

describe("decimal utilities", () => {
  it("rounds money half-up without binary floating-point arithmetic", () => {
    expect(roundMoney("1.005").toFixed(2)).toBe("1.01");
    expect(roundMoney("999999999999.994").toFixed(2)).toBe("999999999999.99");
  });

  it("serializes large decimals without scientific notation or precision loss", () => {
    expect(serializeDecimal("1234567890123456.7890")).toBe("1234567890123456.789");
  });

  it("enforces the unit's allowed quantity scale", () => {
    expect(validateQuantity("12", 0).toFixed()).toBe("12");
    expect(validateQuantity("1.234", 3).toFixed()).toBe("1.234");
    expect(() => validateQuantity("1.5", 0)).toThrow(ApplicationError);
    expect(() => validateQuantity("1.2345", 3)).toThrow("at most 3 decimal places");
  });

  it("rejects zero and negative quantities", () => {
    expect(() => validateQuantity("0", 3)).toThrow("greater than zero");
    expect(() => validateQuantity("-1", 3)).toThrow("greater than zero");
  });
});
