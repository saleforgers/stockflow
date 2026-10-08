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

  it("rejects negative, excessive, and zero-cost discounts", () => {
    expect(() => purchaseLineAmount("2", "10", 0, "-1")).toThrow("negative");
    expect(() => purchaseLineAmount("2", "10", 0, "20.01")).toThrow("exceeds");
    expect(() => purchaseLineAmount("1000", "1", 0, "999.99")).toThrow("greater than zero");
  });

  it.each([
    ["0.01", "332.99", "1.0000"],
    ["0.02", "332.98", "0.9999"],
  ])(
    "accepts a one-paisa cost reconstruction difference with discount %s",
    (discount, total, cost) => {
      const line = purchaseLineAmount("333", "1", 0, discount);
      expect(line.lineTotal.toFixed(2)).toBe(total);
      expect(line.unitCost.toFixed(4)).toBe(cost);
      expect(
        line.quantity
          .times(line.unitCost)
          .toDecimalPlaces(2)
          .minus(line.lineTotal)
          .abs()
          .toFixed(2),
      ).toBe("0.01");
    },
  );

  it("rejects cost reconstruction differences greater than one paisa", () => {
    expect(() => purchaseLineAmount("1000", "1", 0, "0.02")).toThrow("PKR 0.01 tolerance");
    expect(() => purchaseLineAmount("333", "1", 0, "0.05")).toThrow("PKR 0.01 tolerance");
  });

  it("preserves the exact total for the audit's seven-unit discount example", () => {
    const line = purchaseLineAmount("7", "10", 0, "0.05");
    expect(line.lineTotal.toFixed(2)).toBe("69.95");
    expect(line.unitCost.toFixed(4)).toBe("9.9929");
  });

  it("keeps credit, partial, and paid status deterministic", () => {
    expect(paymentStatus("100", "0")).toBe("UNPAID");
    expect(paymentStatus("100", "25")).toBe("PARTIALLY_PAID");
    expect(paymentStatus("100", "100")).toBe("PAID");
  });
});
