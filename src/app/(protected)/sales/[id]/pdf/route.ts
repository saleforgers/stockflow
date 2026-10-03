import { getCurrentUser } from "@/lib/auth/session";
import { getInvoice } from "@/modules/sales/queries";
import { invoiceSummary } from "@/modules/sales/invoice-summary";
import { createBusinessPdf, pdfResponse } from "@/modules/documents/pdf";
import { formatDate, formatPkr, formatQuantity } from "@/lib/format";
import { invoiceStatus } from "@/lib/labels";
export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentUser())) return new Response("Authentication required", { status: 401 });
  const { id } = await params;
  const invoice = await getInvoice(id);
  if (!invoice) return new Response("Invoice not found", { status: 404 });
  const summary = invoiceSummary(invoice);
  const bytes = await createBusinessPdf({
    title: invoice.status === "DRAFT" ? "DRAFT INVOICE" : "INVOICE",
    number: invoice.invoiceNumber,
    date: formatDate(invoice.invoiceDate),
    status: invoiceStatus(invoice.status, invoice.paymentStatus, summary.returned.gt(0)),
    partyLabel: "Bill To",
    party: [
      invoice.customerNameSnapshot,
      invoice.customerPhoneSnapshot ?? "",
      invoice.customerAddressSnapshot ?? "",
    ],
    columns: [
      { label: "Product", width: 145 },
      { label: "SKU", width: 75 },
      { label: "Qty", width: 55, right: true },
      { label: "Rate", width: 80, right: true },
      { label: "Discount", width: 75, right: true },
      { label: "Amount", width: 85, right: true },
    ],
    rows: invoice.lines.map((l) => [
      l.productNameSnapshot,
      l.skuSnapshot,
      `${formatQuantity(l.quantity)} ${l.uomCodeSnapshot}`,
      l.unitPrice.toFixed(4),
      l.lineDiscountAmount.toFixed(2),
      l.netAmount.toFixed(2),
    ]),
    totals: [
      { label: "Subtotal", value: formatPkr(invoice.subtotal) },
      { label: "Invoice Discount", value: formatPkr(invoice.invoiceDiscountAmount) },
      { label: "Grand Total", value: formatPkr(invoice.totalAmount), strong: true },
      { label: "Paid", value: formatPkr(summary.paid) },
      ...(summary.returned.gt(0)
        ? [{ label: "Return Credits", value: formatPkr(summary.returned) }]
        : []),
      { label: "Balance Due", value: formatPkr(summary.balance), strong: true },
    ],
    notes: [
      invoice.notes,
      ...invoice.paymentAllocations.map(
        (a) =>
          `${a.payment.paymentNumber} | ${formatDate(a.payment.paymentDate)} | ${a.payment.paymentMethod.name} | ${formatPkr(a.amount)}`,
      ),
    ]
      .filter(Boolean)
      .join("\n"),
  });
  return pdfResponse(
    bytes,
    `${invoice.invoiceNumber}.pdf`,
    new URL(request.url).searchParams.get("inline") === "1",
  );
}
