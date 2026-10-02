import Decimal from "decimal.js";
import { decimal, roundMoney, validateQuantity, type DecimalInput } from "@/lib/decimal/decimal";
import { ApplicationError } from "@/lib/errors/application-error";
import { nonnegativeMoney } from "@/modules/purchases/calculations";

export function saleLine(quantity: string, price: string, discount: string, scale: number) {
  const q = validateQuantity(quantity, scale);
  const p = decimal(price);
  if (!p.isFinite() || p.lessThanOrEqualTo(0) || p.decimalPlaces() > 4)
    throw new ApplicationError(
      "VALIDATION_ERROR",
      "Selling price must be positive with at most 4 decimal places",
    );
  const gross = roundMoney(q.times(p));
  const d = nonnegativeMoney(discount, "Line discount");
  if (d.greaterThan(gross))
    throw new ApplicationError("VALIDATION_ERROR", "Line discount exceeds gross amount");
  return {
    quantity: q.toFixed(),
    unitPrice: p.toFixed(),
    grossAmount: gross.toFixed(2),
    lineDiscountAmount: d.toFixed(2),
    netAmount: gross.minus(d).toFixed(2),
  };
}

export function fifoPlan<
  T extends { id: string; availableQuantity: DecimalInput; unitCost: DecimalInput },
>(orderedLots: readonly T[], quantity: DecimalInput) {
  let remaining = decimal(quantity);
  const allocations: { lot: T; quantity: Decimal }[] = [];
  for (const lot of orderedLots) {
    const taken = Decimal.min(remaining, decimal(lot.availableQuantity));
    if (taken.greaterThan(0)) allocations.push({ lot, quantity: taken });
    remaining = remaining.minus(taken);
    if (remaining.isZero()) break;
  }
  if (remaining.greaterThan(0))
    throw new ApplicationError("INSUFFICIENT_STOCK", "Insufficient available stock");
  return allocations;
}

/** Cumulative credit avoids losing or creating cents over repeated partial returns. */
export function returnCredit(
  net: DecimalInput,
  sold: DecimalInput,
  previouslyReturned: DecimalInput,
  quantity: DecimalInput,
  previouslyCredited: DecimalInput,
) {
  const cumulative = decimal(previouslyReturned).plus(decimal(quantity));
  if (cumulative.greaterThan(decimal(sold)))
    throw new ApplicationError("VALIDATION_ERROR", "Return exceeds remaining sold quantity");
  return roundMoney(decimal(net).times(cumulative).div(decimal(sold))).minus(
    decimal(previouslyCredited),
  );
}
