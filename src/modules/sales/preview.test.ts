import { it, expect } from "vitest";
import { invoicePreview } from "./preview";
it("detects combined stock demand for duplicate product rows and uses decimal totals", () => {
  const line = { productId: "product", quantity: "3", unitPrice: "0.10", lineDiscountAmount: "0" };
  const p = invoicePreview(
    {
      customerId: "customer",
      invoiceDate: "2026-10-03",
      invoiceDiscountAmount: "0.10",
      lines: [line, line],
    },
    [{ id: "product", available: "5", inventoryUnit: { decimalScale: 0 } }],
    "0.20",
  );
  expect(p.total).toBe("0.50");
  expect(p.balance).toBe("0.30");
  expect(p.shortages.every(Boolean)).toBe(true);
});
