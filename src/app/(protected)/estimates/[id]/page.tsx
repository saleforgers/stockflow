import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { formatDate, formatPkr } from "@/lib/format";
import { businessLabel } from "@/lib/labels";
import { PageHeader } from "@/components/ui/page-header";
import { CommandForm } from "@/components/ui/command-form";
import { PdfActions } from "@/components/ui/pdf-actions";
import { getEstimate } from "@/modules/estimates/queries";
import { estimateItems } from "@/modules/estimates/services";
import { convertEstimateAction, estimateStatusAction } from "@/modules/estimates/actions";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const estimate = await getEstimate(id);
  if (!estimate) notFound();
  const items = estimateItems(estimate.lines),
    editable = user.role !== "STAFF" && !["CONVERTED", "CANCELLED"].includes(estimate.status);
  return (
    <>
      <PageHeader
        title={estimate.estimateNumber}
        description={`${estimate.customerNameSnapshot} · ${formatDate(estimate.estimateDate)} · ${businessLabel(estimate.status)}`}
      />
      <div className="flex flex-wrap gap-3">
        <PdfActions href={`/estimates/${id}/pdf`} title={`Estimate ${estimate.estimateNumber}`} />
        {editable && (
          <Link className="btn-secondary" href={`/estimates/${id}/edit`}>
            Edit Estimate
          </Link>
        )}
        {estimate.convertedInvoice && (
          <Link className="btn-primary" href={`/sales/${estimate.convertedInvoice.id}`}>
            Open {estimate.convertedInvoice.invoiceNumber}
          </Link>
        )}
      </div>
      {estimate.validUntil && <p>Valid Until: {formatDate(estimate.validUntil)}</p>}
      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>Discount</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((l, i) => (
              <tr key={i}>
                <td>{l.productNameSnapshot}</td>
                <td>{l.skuSnapshot}</td>
                <td>
                  {l.quantity} {l.uomCodeSnapshot}
                </td>
                <td>{formatPkr(l.unitPrice)}</td>
                <td>{formatPkr(l.lineDiscountAmount)}</td>
                <td>{formatPkr(l.netAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card space-y-2 p-5">
        <p>Subtotal: {formatPkr(estimate.subtotal)}</p>
        <p>Invoice Discount: {formatPkr(estimate.invoiceDiscountAmount)}</p>
        <p className="text-xl font-semibold">Total: {formatPkr(estimate.totalAmount)}</p>
        <p>{estimate.notes}</p>
      </div>
      {editable && (
        <div className="flex flex-wrap items-start gap-4">
          <CommandForm
            action={convertEstimateAction.bind(null, id)}
            label="Convert to Invoice"
            confirm="Create a draft invoice from this estimate? Stock changes only when the invoice is finalized."
          />
          {estimate.status === "DRAFT" && (
            <CommandForm
              action={estimateStatusAction.bind(null, id, "SENT")}
              label="Mark as Sent"
            />
          )}
          {estimate.status !== "ACCEPTED" && (
            <CommandForm
              action={estimateStatusAction.bind(null, id, "ACCEPTED")}
              label="Mark as Accepted"
            />
          )}
          <CommandForm
            action={estimateStatusAction.bind(null, id, "CANCELLED")}
            label="Cancel Estimate"
            confirm="Cancel this estimate?"
          />
        </div>
      )}
      <p className="text-sm text-slate-500">
        This quotation has no effect on inventory, customer balance or profit.
      </p>
    </>
  );
}
