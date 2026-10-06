const labels: Record<string, string> = {
  DRAFT: "Draft",
  POSTED: "Finalized",
  VOID: "Cancelled",
  UNPAID: "Unpaid",
  PARTIALLY_PAID: "Partially Paid",
  PAID: "Paid",
  PURCHASE: "Purchase",
  SALE: "Sale",
  SALE_RETURN: "Sale Return",
  PURCHASE_RETURN: "Purchase Return",
  PAYMENT: "Payment",
  REFUND: "Refund",
  OPENING_STOCK: "Opening Stock",
  STOCK_ADJUSTMENT: "Stock Adjustment",
  DAMAGED: "Damage",
  LOST: "Loss",
  CORRECTION: "Count Correction",
  OTHER: "Other",
  ADJUSTMENT_INCREASE: "Balance adjustment",
  ADJUSTMENT_DECREASE: "Balance adjustment",
  REVERSAL: "Reversal",
  OPEN: "Available",
  DEPLETED: "Used up",
  CLOSED: "Closed",
};
export function businessLabel(value: string): string {
  return (
    labels[value] ??
    value
      .toLowerCase()
      .replaceAll("_", " ")
      .replace(/^./, (c) => c.toUpperCase())
  );
}
export function invoiceStatus(status: string, paymentStatus: string, returned = false) {
  return status === "POSTED"
    ? returned
      ? "Returned"
      : businessLabel(paymentStatus)
    : businessLabel(status);
}
