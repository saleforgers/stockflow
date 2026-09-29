import Decimal from "decimal.js";

import { MONEY_SCALE, roundMoney, type DecimalInput } from "./decimal";
import { ApplicationError } from "@/lib/errors/application-error";

export interface DiscountAllocationInput {
  readonly id: string;
  readonly netAmount: DecimalInput;
}

/**
 * Allocates an invoice-level discount using the approved largest-remainder rule.
 * The authoritative discount remains on the invoice header; these values are snapshots.
 */
export function allocateInvoiceDiscount(
  lines: readonly DiscountAllocationInput[],
  discountAmount: DecimalInput,
): ReadonlyMap<string, Decimal> {
  if (new Set(lines.map((line) => line.id)).size !== lines.length) {
    throw new ApplicationError("VALIDATION_ERROR", "Discount allocation line IDs must be unique");
  }

  const discount = roundMoney(discountAmount);
  const weightedLines = lines.map((line) => ({ ...line, weight: roundMoney(line.netAmount) }));
  const subtotal = Decimal.sum(...weightedLines.map((line) => line.weight));

  if (discount.isNegative() || discount.greaterThan(subtotal)) {
    throw new ApplicationError(
      "VALIDATION_ERROR",
      "Invoice discount must be between zero and the invoice subtotal",
    );
  }

  if (discount.isZero()) {
    return new Map(weightedLines.map((line) => [line.id, new Decimal(0)]));
  }

  if (subtotal.isZero()) {
    throw new ApplicationError(
      "VALIDATION_ERROR",
      "A positive invoice discount cannot be allocated across a zero subtotal",
    );
  }

  const centsFactor = new Decimal(10).pow(MONEY_SCALE);
  const totalCents = discount.mul(centsFactor).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  const shares = weightedLines.map((line) => {
    const exactCents = totalCents.mul(line.weight).div(subtotal);
    const baseCents = exactCents.toDecimalPlaces(0, Decimal.ROUND_FLOOR);

    return {
      id: line.id,
      baseCents,
      fraction: exactCents.minus(baseCents),
    };
  });

  const allocatedBaseCents = Decimal.sum(...shares.map((share) => share.baseCents));
  const remainderCount = totalCents.minus(allocatedBaseCents).toNumber();
  const remainderOrder = [...shares].sort(
    (left, right) => right.fraction.comparedTo(left.fraction) || left.id.localeCompare(right.id),
  );
  const awardedIds = new Set(remainderOrder.slice(0, remainderCount).map((share) => share.id));

  return new Map(
    shares.map((share) => [
      share.id,
      share.baseCents.plus(awardedIds.has(share.id) ? 1 : 0).div(centsFactor),
    ]),
  );
}
