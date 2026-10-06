import type { InvoiceDraftCommand } from "./validation";

export function newInvoiceCommand(date: string, requestKey?: string): InvoiceDraftCommand {
  return {
    requestKey,
    customerId: "",
    invoiceDate: date,
    invoiceDiscountAmount: "0",
    notes: "",
    lines: [{ productId: "", quantity: "1", unitPrice: "", lineDiscountAmount: "0" }],
  };
}
