import { describe, expect, it } from "vitest";
import { paymentStatus, purchaseLineAmount } from "./calculations";

describe("Purchase financial rules", () => {
  it("applies a fixed line discount and derives the net FIFO unit cost", () => {
    const line = purchaseLineAmount("4", "25.0000", 0, "10.00");
    expect(line.grossAmount.toFixed(2)).toBe("100.00");
    expect(line.lineDiscountAmount.toFixed(2)).toBe("10.00");
    expect(line.lineTotal.toFixed(2)).toBe("90.00");
    expect(line.unitCost.toFixed(4)).toBe("22.5000");
  });

  it("rejects negative, excessive, and non-representable discounts", () => {
    expect(() => purchaseLineAmount("2", "10", 0, "-1")).toThrow("negative");
    expect(() => purchaseLineAmount("2", "10", 0, "20.01")).toThrow("exceeds");
    expect(() => purchaseLineAmount("1000", "1", 0, "999.99")).toThrow("represented exactly");
  });

  it("keeps credit, partial, and paid status deterministic", () => {
    expect(paymentStatus("100", "0")).toBe("UNPAID");
    expect(paymentStatus("100", "25")).toBe("PARTIALLY_PAID");
    expect(paymentStatus("100", "100")).toBe("PAID");
  });
});
