import Decimal from "decimal.js";

import { ApplicationError } from "@/lib/errors/application-error";

export const MONEY_SCALE = 2;
export const DATABASE_QUANTITY_SCALE = 4;

export type DecimalInput = Decimal.Value | { toString(): string };

export function decimal(value: DecimalInput): Decimal {
  try {
    return new Decimal(value.toString());
  } catch (cause) {
    throw new ApplicationError("VALIDATION_ERROR", "Value is not a valid decimal", {
      cause,
      details: { value: String(value) },
    });
  }
}

export function roundMoney(value: DecimalInput): Decimal {
  return decimal(value).toDecimalPlaces(MONEY_SCALE, Decimal.ROUND_HALF_UP);
}

export function serializeDecimal(value: DecimalInput): string {
  return decimal(value).toFixed();
}

export function validateQuantity(value: DecimalInput, allowedDecimalScale: number): Decimal {
  if (
    !Number.isInteger(allowedDecimalScale) ||
    allowedDecimalScale < 0 ||
    allowedDecimalScale > DATABASE_QUANTITY_SCALE
  ) {
    throw new ApplicationError(
      "INVARIANT_VIOLATION",
      `Quantity scale must be an integer between 0 and ${DATABASE_QUANTITY_SCALE}`,
      { details: { allowedDecimalScale } },
    );
  }

  const quantity = decimal(value);

  if (quantity.lessThanOrEqualTo(0)) {
    throw new ApplicationError("VALIDATION_ERROR", "Quantity must be greater than zero");
  }

  if (quantity.decimalPlaces() > allowedDecimalScale) {
    throw new ApplicationError(
      "VALIDATION_ERROR",
      `Quantity allows at most ${allowedDecimalScale} decimal places`,
      { details: { quantity: quantity.toFixed(), allowedDecimalScale } },
    );
  }

  return quantity;
}
