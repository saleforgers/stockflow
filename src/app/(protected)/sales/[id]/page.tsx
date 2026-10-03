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
import { SummaryCards } from "@/components/ui/summary-cards";
import { PrintButton } from "@/components/ui/print-button";
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
        <Link className="btn-secondary" href={`/sales/${id}/pdf`}>
          Download PDF
        </Link>
        <PrintButton />
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
      <SummaryCards
        items={[
          { label: "Grand Total", value: formatPkr(invoice.totalAmount) },
          { label: "Paid", value: formatPkr(summary.paid) },
          { label: "Return Credits", value: formatPkr(summary.returned) },
          { label: "Balance Due", value: formatPkr(summary.balance) },
        ]}
      />
      <div className="card p-5">
        <h2 className="font-semibold">Customer</h2>
        <p>{invoice.customerNameSnapshot}</p>
        <p>{invoice.customerPhoneSnapshot}</p>
        <p>{invoice.customerAddressSnapshot}</p>
      </div>
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
      <div className="card ml-auto w-full space-y-3 p-6 sm:max-w-md">
        <p>
          Subtotal <strong className="float-right">{formatPkr(invoice.subtotal)}</strong>
        </p>
        <p>
          Invoice Discount{" "}
          <strong className="float-right">{formatPkr(invoice.invoiceDiscountAmount)}</strong>
        </p>
        <p className="border-t pt-3 text-lg">
          Grand Total <strong className="float-right">{formatPkr(invoice.totalAmount)}</strong>
        </p>
        <p>
          Paid <strong className="float-right">{formatPkr(summary.paid)}</strong>
        </p>
        {summary.returned.gt(0) && (
          <p>
            Return Credits <strong className="float-right">{formatPkr(summary.returned)}</strong>
          </p>
        )}
        <p>
          Balance Due <strong className="float-right">{formatPkr(summary.balance)}</strong>
        </p>
      </div>
      {invoice.notes && <p className="card p-5">{invoice.notes}</p>}
      {options && (
        <PostInvoiceForm
          action={postInvoiceAction.bind(null, id)}
          methods={options.paymentMethods}
          walkIn={invoice.customer.isWalkIn && decimal(invoice.totalAmount).gt(0)}
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
