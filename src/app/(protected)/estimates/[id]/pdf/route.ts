import { getCurrentUser } from "@/lib/auth/session";
import { getEstimate } from "@/modules/estimates/queries";
import { estimateItems } from "@/modules/estimates/services";
import { createBusinessPdf, pdfResponse } from "@/modules/documents/pdf";
import { formatDate, formatPkr, formatQuantity } from "@/lib/format";
import { businessLabel } from "@/lib/labels";
export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentUser())) return new Response("Authentication required", { status: 401 });
  const estimate = await getEstimate((await params).id);
  if (!estimate) return new Response("Estimate not found", { status: 404 });
  const bytes = await createBusinessPdf({
    title: "ESTIMATE / QUOTATION",
    number: estimate.estimateNumber,
    date: formatDate(estimate.estimateDate),
    status: businessLabel(estimate.status),
    partyLabel: "Prepared For",
    party: [
      estimate.customerNameSnapshot,
      estimate.customerPhoneSnapshot ?? "",
      estimate.customerAddressSnapshot ?? "",
    ],
    metadata: estimate.validUntil ? [`Valid Until: ${formatDate(estimate.validUntil)}`] : [],
    columns: [
      { label: "Product", width: 145 },
      { label: "SKU", width: 75 },
      { label: "Qty", width: 55, right: true },
      { label: "Rate", width: 80, right: true },
      { label: "Discount", width: 75, right: true },
      { label: "Amount", width: 85, right: true },
    ],
    rows: estimateItems(estimate.lines).map((l) => [
      l.productNameSnapshot,
      l.skuSnapshot,
      `${formatQuantity(l.quantity)} ${l.uomCodeSnapshot}`,
      l.unitPrice,
      l.lineDiscountAmount,
      l.netAmount,
    ]),
    totals: [
      { label: "Subtotal", value: formatPkr(estimate.subtotal) },
      { label: "Discount", value: formatPkr(estimate.invoiceDiscountAmount) },
      { label: "Estimate Total", value: formatPkr(estimate.totalAmount), strong: true },
    ],
    notes: [
      estimate.notes,
      "Quotation only. Stock and prices are confirmed when an invoice is finalized.",
    ]
      .filter(Boolean)
      .join("\n"),
  });
  return pdfResponse(
    bytes,
    `${estimate.estimateNumber}.pdf`,
    new URL(request.url).searchParams.get("inline") === "1",
  );
}
