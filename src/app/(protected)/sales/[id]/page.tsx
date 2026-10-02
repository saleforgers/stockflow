import Link from "next/link";
import { notFound } from "next/navigation";
import Decimal from "decimal.js";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth/session";
import { formatPkr, formatQuantity, formatDate } from "@/lib/format";
import { decimal } from "@/lib/decimal/decimal";
import { getInvoice, getSalesOptions } from "@/modules/sales/queries";
import { PostInvoiceForm } from "@/modules/sales/forms";
import { postInvoiceAction } from "@/modules/sales/actions";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const invoice = await getInvoice(id);
  if (!invoice) notFound();
  const writer = user.role !== "STAFF";
  const receipts = invoice.paymentAllocations.reduce(
    (s, a) => s.plus(a.amount.toString()),
    new Decimal(0),
  );
  const credits = invoice.returns.reduce(
    (s, r) => s.plus(r.totalAmount.toString()),
    new Decimal(0),
  );
  const options = writer && invoice.status === "DRAFT" ? await getSalesOptions() : null;
  return (
    <>
      <PageHeader
        title={invoice.invoiceNumber}
        description={`${invoice.customerNameSnapshot} · ${formatDate(invoice.invoiceDate)} · ${invoice.status}`}
      />
      <div className="flex flex-wrap gap-3">
        <Link className="btn-secondary" href={`/customers/${invoice.customerId}/account`}>
          Customer account
        </Link>
        {writer && invoice.status === "DRAFT" && (
          <Link className="btn-secondary" href={`/sales/${id}/edit`}>
            Edit draft
          </Link>
        )}
        {writer && invoice.status === "POSTED" && (
          <>
            <Link className="btn-secondary" href={`/sales/${id}/return`}>
              Sale return
            </Link>
            <Link
              className="btn-secondary"
              href={`/customer-receipts/new?customerId=${invoice.customerId}`}
            >
              Record receipt
            </Link>
          </>
        )}
      </div>
      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Product / unit</th>
              <th>Quantity</th>
              <th>Price</th>
              <th>Gross</th>
              <th>Line discount</th>
              <th>Net</th>
              <th>Invoice discount share</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((l) => (
              <tr key={l.id}>
                <td>
                  {l.skuSnapshot} — {l.productNameSnapshot} ({l.uomCodeSnapshot})
                </td>
                <td>{formatQuantity(l.quantity)}</td>
                <td>{formatPkr(l.unitPrice)}</td>
                <td>{formatPkr(l.grossAmount)}</td>
                <td>{formatPkr(l.lineDiscountAmount)}</td>
                <td>{formatPkr(l.netAmount)}</td>
                <td>{formatPkr(l.invoiceDiscountAllocated)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card space-y-2 p-6">
        <p>Subtotal: {formatPkr(invoice.subtotal)}</p>
        <p>Invoice discount: {formatPkr(invoice.invoiceDiscountAmount)}</p>
        <p className="font-semibold">Total: {formatPkr(invoice.totalAmount)}</p>
        {invoice.status === "POSTED" && (
          <>
            <p>
              Receipts allocated: {formatPkr(receipts)} · Return credits: {formatPkr(credits)}
            </p>
            <p>
              Outstanding:{" "}
              {formatPkr(
                Decimal.max(decimal(invoice.totalAmount).minus(receipts).minus(credits), 0),
              )}{" "}
              · {invoice.paymentStatus}
            </p>
          </>
        )}
        <p>{invoice.notes}</p>
      </div>
      {options && (
        <PostInvoiceForm
          action={postInvoiceAction.bind(null, id)}
          methods={options.paymentMethods}
          walkIn={invoice.customer.isWalkIn && decimal(invoice.totalAmount).greaterThan(0)}
        />
      )}
      {invoice.status === "POSTED" && (
        <>
          <h2 className="text-lg font-semibold">FIFO cost allocations</h2>
          <div className="card overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Original lot</th>
                  <th>Received</th>
                  <th>Quantity</th>
                  <th>Original unit cost</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lines.flatMap((l) =>
                  l.lotAllocations.map((a) => (
                    <tr key={a.id}>
                      <td>{l.skuSnapshot}</td>
                      <td>{a.inventoryLot.purchaseLot?.lotNumber ?? a.inventoryLotId}</td>
                      <td>{formatDate(a.inventoryLot.receivedAt)}</td>
                      <td>{formatQuantity(a.quantity)}</td>
                      <td>{formatPkr(a.unitCostSnapshot)}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
          <h2 className="text-lg font-semibold">Receipts and returns</h2>
          <div className="card space-y-2 p-6">
            {invoice.paymentAllocations.map((a) => (
              <p key={a.id}>
                {a.payment.paymentNumber} · {formatDate(a.payment.paymentDate)} · Allocated{" "}
                {formatPkr(a.amount)}
              </p>
            ))}
            {invoice.returns.map((r) => (
              <div key={r.id} className="border-t pt-2">
                <p>
                  {r.returnNumber} · {formatDate(r.returnDate)} · {r.reason} · Credit{" "}
                  {formatPkr(r.totalAmount)}
                </p>
                {r.lines.map((l) => (
                  <p key={l.id}>
                    Returned {formatQuantity(l.quantity)} ·{" "}
                    {l.allocations
                      .map(
                        (a) =>
                          `${formatQuantity(a.quantity)} at ${a.unitCostSnapshot.toFixed(4)} PKR (original allocation ${a.saleLotAllocationId})`,
                      )
                      .join("; ")}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
