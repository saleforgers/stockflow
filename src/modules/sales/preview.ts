import Decimal from "decimal.js";
import { saleLine } from "./calculations";
import type { InvoiceDraftCommand } from "./validation";
export function invoicePreview(
  command: InvoiceDraftCommand,
  products: { id: string; available: string; inventoryUnit: { decimalScale: number } }[],
  paid: string,
) {
  let error = "";
  const amounts = command.lines.map((l) => {
    const product = products.find((p) => p.id === l.productId);
    try {
      return saleLine(
        l.quantity,
        l.unitPrice,
        l.lineDiscountAmount,
        product?.inventoryUnit.decimalScale ?? 4,
      ).netAmount;
    } catch {
      error = "Enter a valid quantity, rate and discount for every product.";
      return "0";
    }
  });
  const shortages = command.lines.map((l) => {
    const p = products.find((p) => p.id === l.productId);
    try {
      const required = command.lines
        .filter((r) => r.productId === l.productId)
        .reduce((s, r) => s.plus(r.quantity), new Decimal(0));
      return p && required.gt(p.available)
        ? `Only ${p.available} ${p.inventoryUnit ? "units" : ""} are currently available.`
        : "";
    } catch {
      return "";
    }
  });
  const subtotal = amounts.reduce((s, a) => s.plus(a), new Decimal(0));
  let discount = new Decimal(0);
  let payment = new Decimal(0);
  try {
    discount = new Decimal(command.invoiceDiscountAmount || "0");
    payment = new Decimal(paid || "0");
    if (
      !discount.isFinite() ||
      discount.lt(0) ||
      discount.gt(subtotal) ||
      discount.decimalPlaces() > 2 ||
      !payment.isFinite() ||
      payment.lt(0) ||
      payment.decimalPlaces() > 2
    )
      error = "Check invoice discount and payment amount.";
  } catch {
    error = "Check invoice discount and payment amount.";
  }
  const total = subtotal.minus(discount);
  return {
    amounts,
    shortages,
    error,
    subtotal: subtotal.toFixed(2),
    total: total.toFixed(2),
    balance: Decimal.max(total.minus(payment), 0).toFixed(2),
  };
}
