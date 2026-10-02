import { describe, expect, it } from "vitest";
import { fifoPlan, returnCredit, saleLine } from "./calculations";
import { invoiceDraftSchema } from "./validation";
describe("Sales financial rules", () => {
  it("rounds gross before fixed discount without floating point", () => {
    expect(saleLine("1.125", "12.3456", "0.89", 3)).toMatchObject({
      grossAmount: "13.89",
      netAmount: "13.00",
    });
  });
  it("rejects quantities outside UOM precision and excessive discounts", () => {
    expect(() => saleLine("1.1", "10", "0", 0)).toThrow();
    expect(() => saleLine("1", "10", "10.01", 0)).toThrow();
    expect(() => saleLine("1", "0", "0", 0)).toThrow();
  });
  it("consumes several ordered lots at their original costs", () => {
    const plan = fifoPlan(
      [
        { id: "old", availableQuantity: "2", unitCost: "10.1234" },
        { id: "new", availableQuantity: "4", unitCost: "20" },
      ],
      "3",
    );
    expect(plan.map((a) => [a.lot.id, a.quantity.toFixed(), a.lot.unitCost])).toEqual([
      ["old", "2", "10.1234"],
      ["new", "1", "20"],
    ]);
  });
  it("rejects insufficient stock without mutating source layers", () => {
    const lots = [{ id: "one", availableQuantity: "1", unitCost: "5" }];
    expect(() => fifoPlan(lots, "2")).toThrow("Insufficient");
    expect(lots[0]?.availableQuantity).toBe("1");
  });
  it("clears the exact discounted net amount over partial returns", () => {
    expect(returnCredit("10", "3", "0", "1", "0").toFixed(2)).toBe("3.33");
    expect(returnCredit("10", "3", "1", "1", "3.33").toFixed(2)).toBe("3.34");
    expect(returnCredit("10", "3", "2", "1", "6.67").toFixed(2)).toBe("3.33");
    expect(() => returnCredit("10", "3", "2", "2", "6.67")).toThrow();
  });
  it("rejects non-finite and exponent input at the command boundary", () => {
    const c = {
      customerId: "00000000-0000-4000-8000-000000000001",
      invoiceDate: "2026-10-01",
      lines: [
        { productId: "00000000-0000-4000-8000-000000000002", quantity: "1", unitPrice: "NaN" },
      ],
    };
    expect(invoiceDraftSchema.safeParse(c).success).toBe(false);
    expect(
      invoiceDraftSchema.safeParse({ ...c, lines: [{ ...c.lines[0], unitPrice: "1e3" }] }).success,
    ).toBe(false);
  });
});
