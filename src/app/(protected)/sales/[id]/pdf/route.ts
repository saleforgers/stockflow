import Decimal from "decimal.js";
import { requireUser } from "@/lib/auth/session";
import { decimal } from "@/lib/decimal/decimal";
import { pdfResponse, simpleTextPdf } from "@/lib/pdf/simple-pdf";
import { getInvoice, getInvoiceAccountSummary } from "@/modules/sales/queries";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const [invoice, account] = await Promise.all([getInvoice(id), getInvoiceAccountSummary(id)]);
  if (!invoice) return new Response("Invoice not found", { status: 404 });
  const received = invoice.paymentAllocations.reduce(
    (sum, row) => sum.plus(row.amount.toString()),
    new Decimal(0),
  );
  const credits = invoice.returns.reduce(
    (sum, row) => sum.plus(row.totalAmount.toString()),
    new Decimal(0),
  );
  const balance = Decimal.max(decimal(invoice.totalAmount).minus(received).minus(credits), 0);
  const lines = [
    `Invoice: ${invoice.invoiceNumber}`,
    `Date: ${invoice.invoiceDate.toISOString().slice(0, 10)}`,
    `Customer: ${invoice.customerNameSnapshot}`,
    `Phone: ${invoice.customerPhoneSnapshot ?? "-"}`,
    "",
    "Product / SKU | Qty | Rate | Discount | Amount",
    ...invoice.lines.map(
      (line) =>
        `${line.productNameSnapshot} / ${line.skuSnapshot} | ${line.quantity.toFixed()} ${line.uomCodeSnapshot} | PKR ${line.unitPrice.toFixed(2)} | PKR ${line.lineDiscountAmount.toFixed(2)} | PKR ${line.netAmount.toFixed(2)}`,
    ),
    "",
    `Subtotal: PKR ${invoice.subtotal.toFixed(2)}`,
    `Invoice discount: PKR ${invoice.invoiceDiscountAmount.toFixed(2)}`,
    `Invoice total: PKR ${invoice.totalAmount.toFixed(2)}`,
    `Paid on this invoice: PKR ${received.toFixed(2)}`,
    `Return credits: PKR ${credits.toFixed(2)}`,
    `Invoice balance: PKR ${balance.toFixed(2)}`,
    `Previous account balance: PKR ${account?.previousBalance ?? "0.00"}`,
    `Current customer outstanding: PKR ${account?.currentOutstanding ?? "0.00"}`,
  ];
  return pdfResponse(
    `${invoice.invoiceNumber}.pdf`,
    simpleTextPdf("StockFlow Sales Invoice", lines),
  );
}
