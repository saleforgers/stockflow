import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth/session";
import { formatPkr, formatQuantity, formatDate } from "@/lib/format";
import { decimal } from "@/lib/decimal/decimal";
import { getInvoice, getSalesOptions } from "@/modules/sales/queries";
import { PostInvoiceForm } from "@/modules/sales/forms";
import { postInvoiceAction } from "@/modules/sales/actions";
import { invoiceStatus } from "@/lib/labels";
import { invoiceSummary } from "@/modules/sales/invoice-summary";
import { lotLabel } from "@/modules/inventory/queries";
import { DocumentHeading, DocumentTotals } from "@/components/ui/document-layout";
import { PdfActions } from "@/components/ui/pdf-actions";

function invoiceBadgeClass(status: string, paymentStatus: string, hasReturn: boolean): string {
  if (status === "DRAFT") return "status-badge status-inactive";
  if (paymentStatus === "PAID" && !hasReturn) return "status-badge status-active";
  if (paymentStatus === "PAID" && hasReturn)
    return "status-badge border border-indigo-200 bg-indigo-50 text-indigo-700";
  if (paymentStatus === "PARTIALLY_PAID")
    return "status-badge border border-amber-200 bg-amber-50 text-amber-800";
  return "status-badge border border-blue-200 bg-blue-50 text-blue-700";
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const invoice = await getInvoice(id);
  if (!invoice) notFound();
  const writer = user.role !== "STAFF";
  const summary = invoiceSummary(invoice);
  const options = writer && invoice.status === "DRAFT" ? await getSalesOptions(false) : null;
  return (
    <>
      <PageHeader
        title={invoice.invoiceNumber}
        description={`${invoice.customerNameSnapshot} · ${formatDate(invoice.invoiceDate)} · ${invoiceStatus(invoice.status, invoice.paymentStatus, summary.returned.gt(0))}`}
      />
      {query.success && invoice.status === "POSTED" && (
        <p className="alert-success" role="status">
          Invoice finalized. Stock and customer balance have been updated.
        </p>
      )}
      {query.error && (
        <p className="alert-error" role="alert">
          {query.error}
        </p>
      )}
      <div className="flex flex-wrap gap-3 print:hidden">
        <PdfActions href={`/sales/${id}/pdf`} title={`Invoice ${invoice.invoiceNumber}`} />
        <Link className="btn-secondary" href={`/customers/${invoice.customerId}/account`}>
          Customer Account
        </Link>
        {writer && invoice.status === "DRAFT" && (
          <Link className="btn-secondary" href={`/sales/${id}/edit`}>
            Edit Draft
          </Link>
        )}
        {writer && invoice.status === "POSTED" && (
          <>
            <Link className="btn-secondary" href={`/sales/${id}/return`}>
              Create Return
            </Link>
            <Link
              className="btn-primary"
              href={`/customer-receipts/new?customerId=${invoice.customerId}`}
            >
              Record Payment
            </Link>
          </>
        )}
      </div>
      <section className="card invoice-document">
        <DocumentHeading
          title="Sale invoice"
          description={`${invoice.invoiceNumber} · ${formatDate(invoice.invoiceDate)}`}
          aside={
            <span
              className={invoiceBadgeClass(
                invoice.status,
                invoice.paymentStatus,
                summary.returned.gt(0),
              )}
            >
              {invoiceStatus(invoice.status, invoice.paymentStatus, summary.returned.gt(0))}
            </span>
          }
        />
        <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div>
            <h2 className="document-eyebrow mb-2">Customer</h2>
            <p className="text-lg font-semibold">{invoice.customerNameSnapshot}</p>
            <p className="mt-1 text-sm text-slate-500">{invoice.customerPhoneSnapshot}</p>
            <p className="text-sm text-slate-500">{invoice.customerAddressSnapshot}</p>
            {invoice.notes && (
              <p className="mt-4 whitespace-pre-wrap text-sm text-slate-600">{invoice.notes}</p>
            )}
          </div>
          <DocumentTotals>
            <p className="flex justify-between gap-3">
              <span>Subtotal</span>
              <strong>{formatPkr(invoice.subtotal)}</strong>
            </p>
            <p className="flex justify-between gap-3">
              <span>Invoice discount</span>
              <strong>{formatPkr(invoice.invoiceDiscountAmount)}</strong>
            </p>
            <p className="flex justify-between gap-3 border-t border-indigo-200 pt-3 text-lg font-semibold text-indigo-900">
              <span>Grand total</span>
              <strong>{formatPkr(invoice.totalAmount)}</strong>
            </p>
            <p className="flex justify-between gap-3 text-emerald-700">
              <span>Paid</span>
              <strong>{formatPkr(summary.paid)}</strong>
            </p>
            {summary.returned.gt(0) && (
              <p className="flex justify-between gap-3">
                <span>Return credits</span>
                <strong>{formatPkr(summary.returned)}</strong>
              </p>
            )}
            <p className="flex justify-between gap-3 font-semibold">
              <span>Balance due</span>
              <strong>{formatPkr(summary.balance)}</strong>
            </p>
          </DocumentTotals>
        </div>
      </section>
      <div className="card invoice-document overflow-x-auto">
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
            {invoice.lines.map((l) => (
              <tr key={l.id}>
                <td>{l.productNameSnapshot}</td>
                <td>{l.skuSnapshot}</td>
                <td>
                  {formatQuantity(l.quantity)} {l.uomCodeSnapshot}
                </td>
                <td>{formatPkr(l.unitPrice)}</td>
                <td>{formatPkr(l.lineDiscountAmount)}</td>
                <td>{formatPkr(l.netAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {options && (
        <PostInvoiceForm
          action={postInvoiceAction.bind(null, id)}
          methods={options.paymentMethods}
          walkIn={invoice.customer.isWalkIn && decimal(invoice.totalAmount).gt(0)}
          total={invoice.totalAmount.toFixed(2)}
        />
      )}
      {invoice.status === "POSTED" && (
        <>
          <details className="card p-5">
            <summary className="cursor-pointer font-semibold">Stock Allocation Details</summary>
            <p className="my-3 text-sm text-slate-500">
              Stock is automatically taken from the oldest available lots.
            </p>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Lot</th>
                    <th>Received</th>
                    <th>Qty Used</th>
                    <th>Original Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lines.flatMap((l) =>
                    l.lotAllocations.map((a) => (
                      <tr key={a.id}>
                        <td>{l.productNameSnapshot}</td>
                        <td>{lotLabel(a.inventoryLot)}</td>
                        <td>{formatDate(a.inventoryLot.receivedAt)}</td>
                        <td>{formatQuantity(a.quantity)}</td>
                        <td>{formatPkr(a.unitCostSnapshot)}</td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          </details>
          <section className="card space-y-3 p-5">
            <h2 className="font-semibold">Payment History</h2>
            {invoice.paymentAllocations.map((a) => (
              <p key={a.id}>
                {a.payment.paymentNumber} · {formatDate(a.payment.paymentDate)} ·{" "}
                {a.payment.paymentMethod.name} · {formatPkr(a.amount)}
              </p>
            ))}
            {!invoice.paymentAllocations.length && (
              <p className="text-slate-500">No payments recorded against this invoice.</p>
            )}
          </section>
          <section className="card space-y-3 p-5">
            <h2 className="font-semibold">Returns</h2>
            {invoice.returns.map((r) => (
              <div key={r.id}>
                <p>
                  {r.returnNumber} · {formatDate(r.returnDate)} · {r.reason} · Credit{" "}
                  {formatPkr(r.totalAmount)}
                </p>
                {r.lines.map((l) => (
                  <p key={l.id}>
                    {invoice.lines.find((i) => i.id === l.salesInvoiceLineId)?.productNameSnapshot}{" "}
                    · Returned {formatQuantity(l.quantity)}
                  </p>
                ))}
              </div>
            ))}
            {!invoice.returns.length && <p className="text-slate-500">No returns recorded.</p>}
          </section>
        </>
      )}
    </>
  );
}
