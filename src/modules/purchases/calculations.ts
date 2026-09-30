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

export function purchaseLineAmount(quantity: string, unitCost: string, scale: number) {
  const validatedQuantity = validateQuantity(quantity, scale);
  const validatedCost = positiveUnitCost(unitCost);
  return {
    quantity: validatedQuantity,
    unitCost: validatedCost,
    lineTotal: roundMoney(validatedQuantity.times(validatedCost)),
  };
}

export function paymentStatus(total: Decimal.Value, settled: Decimal.Value) {
  const totalDecimal = decimal(total);
  const settledDecimal = decimal(settled);
  if (settledDecimal.lessThanOrEqualTo(0)) return "UNPAID" as const;
  if (settledDecimal.greaterThanOrEqualTo(totalDecimal)) return "PAID" as const;
  return "PARTIALLY_PAID" as const;
}
