import Decimal from "decimal.js";
import { decimal } from "@/lib/decimal/decimal";
export function invoiceSummary(invoice: {
  totalAmount: { toString(): string };
  paymentAllocations: { amount: { toString(): string } }[];
  returns: { totalAmount: { toString(): string } }[];
}) {
  const paid = invoice.paymentAllocations.reduce(
    (s, a) => s.plus(a.amount.toString()),
    new Decimal(0),
  );
  const returned = invoice.returns.reduce(
    (s, r) => s.plus(r.totalAmount.toString()),
    new Decimal(0),
  );
  return {
    paid,
    returned,
    balance: Decimal.max(decimal(invoice.totalAmount).minus(paid).minus(returned), 0),
  };
}
