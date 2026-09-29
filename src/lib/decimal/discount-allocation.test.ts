import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import { allocateInvoiceDiscount } from "./discount-allocation";

describe("invoice discount allocation", () => {
  it("allocates proportionally and assigns remainder cents deterministically", () => {
    const result = allocateInvoiceDiscount(
      [
        { id: "line-b", netAmount: "1" },
        { id: "line-a", netAmount: "1" },
        { id: "line-c", netAmount: "1" },
      ],
      "0.02",
    );

    expect(result.get("line-a")?.toFixed(2)).toBe("0.01");
    expect(result.get("line-b")?.toFixed(2)).toBe("0.01");
    expect(result.get("line-c")?.toFixed(2)).toBe("0.00");
    expect(Decimal.sum(...result.values()).toFixed(2)).toBe("0.02");
  });

  it("rejects a discount greater than the subtotal", () => {
    expect(() => allocateInvoiceDiscount([{ id: "line-a", netAmount: "10" }], "10.01")).toThrow(
      "between zero and the invoice subtotal",
    );
  });
});
