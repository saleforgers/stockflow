import Decimal from "decimal.js";
import { decimal, roundMoney, validateQuantity } from "@/lib/decimal/decimal";
import { ApplicationError } from "@/lib/errors/application-error";

export function positiveMoney(value: string, label: string): Decimal {
  const amount = roundMoney(value);
  if (amount.lessThanOrEqualTo(0)) {
    throw new ApplicationError("VALIDATION_ERROR", `${label} must be greater than zero`);
  }
  if (!decimal(value).equals(amount)) {
    throw new ApplicationError("VALIDATION_ERROR", `${label} allows at most 2 decimal places`);
  }
  return amount;
}

export function nonnegativeMoney(value: string, label: string): Decimal {
  const amount = roundMoney(value);
  if (amount.isNegative()) {
    throw new ApplicationError("VALIDATION_ERROR", `${label} cannot be negative`);
  }
  if (!decimal(value).equals(amount)) {
    throw new ApplicationError("VALIDATION_ERROR", `${label} allows at most 2 decimal places`);
  }
  return amount;
}

export function positiveUnitCost(value: string): Decimal {
  const cost = decimal(value);
  if (cost.lessThanOrEqualTo(0)) {
    throw new ApplicationError("VALIDATION_ERROR", "Unit cost must be greater than zero");
  }
  if (cost.decimalPlaces() > 4) {
    throw new ApplicationError("VALIDATION_ERROR", "Unit cost allows at most 4 decimal places");
  }
  return cost;
}

export function purchaseLineAmount(
  quantity: string,
  unitPurchasePrice: string,
  scale: number,
  discount = "0",
) {
  const validatedQuantity = validateQuantity(quantity, scale);
  const validatedPrice = positiveUnitCost(unitPurchasePrice);
  const grossAmount = roundMoney(validatedQuantity.times(validatedPrice));
  const lineDiscountAmount = nonnegativeMoney(discount, "Line discount");
  if (lineDiscountAmount.greaterThan(grossAmount)) {
    throw new ApplicationError("VALIDATION_ERROR", "Line discount exceeds gross amount");
  }
  const lineTotal = grossAmount.minus(lineDiscountAmount);
  if (lineTotal.lessThanOrEqualTo(0)) {
    throw new ApplicationError(
      "VALIDATION_ERROR",
      "Discounted line total must be greater than zero",
    );
  }
  const unitCost = lineTotal.div(validatedQuantity).toDecimalPlaces(4);
  if (unitCost.lessThanOrEqualTo(0)) {
    throw new ApplicationError(
      "VALIDATION_ERROR",
      "Discounted unit cost must be greater than zero",
    );
  }
  const reconstructed = roundMoney(validatedQuantity.times(unitCost));
  const delta = reconstructed.minus(lineTotal).abs();
  if (delta.greaterThan(new Decimal("0.01"))) {
    throw new ApplicationError(
      "VALIDATION_ERROR",
      `Unit cost rounding mismatch exceeds PKR 0.01 tolerance (delta: ${delta.toFixed(4)}). Check quantity and discount.`,
    );
  }
  return {
    quantity: validatedQuantity,
    unitPurchasePrice: validatedPrice,
    grossAmount,
    lineDiscountAmount,
    unitCost,
    lineTotal,
  };
}

export function paymentStatus(total: Decimal.Value, settled: Decimal.Value) {
  const totalDecimal = decimal(total);
  const settledDecimal = decimal(settled);
  if (settledDecimal.lessThanOrEqualTo(0)) return "UNPAID" as const;
  if (settledDecimal.greaterThanOrEqualTo(totalDecimal)) return "PAID" as const;
  return "PARTIALLY_PAID" as const;
}
