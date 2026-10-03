import { describe, it, expect } from "vitest";
import { profitTotals } from "./calculations";
describe("management profit", () => {
  it("subtracts original return COGS and expenses without treating purchases as expenses", () => {
    expect(
      profitTotals({
        sales: "1000.10",
        returns: "100.10",
        cost: "650.1234",
        returnedCost: "50.1234",
        expenses: "125.55",
      }),
    ).toEqual({
      netSales: "900.00",
      cogs: "600.00",
      grossProfit: "300.00",
      expenses: "125.55",
      netProfit: "174.45",
    });
  });
});
