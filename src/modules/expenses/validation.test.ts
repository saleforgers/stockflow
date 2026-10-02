import { describe, expect, it } from "vitest";

import { expenseCommandSchema } from "./validation";

const valid = {
  requestKey: "00000000-0000-4000-8000-000000000001",
  expenseDate: "2026-10-03",
  expenseCategoryId: "00000000-0000-4000-8000-000000000002",
  amount: "3500.00",
  paymentMethodId: "00000000-0000-4000-8000-000000000003",
  description: "Unloading purchased stock",
};

describe("expense validation", () => {
  it("accepts fixed-precision PKR input", () => {
    expect(expenseCommandSchema.safeParse(valid).success).toBe(true);
  });

  it.each(["-1", "1.001", "NaN", "", "1e3"])("rejects malformed amount %s", (amount) => {
    expect(expenseCommandSchema.safeParse({ ...valid, amount }).success).toBe(false);
  });
});
