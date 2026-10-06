import { businessLabel } from "@/lib/labels";
import Decimal from "decimal.js";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { getCurrentUser } from "@/lib/auth/session";
import { decimal } from "@/lib/decimal/decimal";
import { formatDate, formatPkr, formatQuantity } from "@/lib/format";
import { postPurchaseAction } from "@/modules/purchases/actions";
import { PostPurchaseForm } from "@/modules/purchases/purchase-form";
import { getActivePurchasePaymentMethods, getPurchase } from "@/modules/purchases/queries";

export default async function PurchaseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [{ id }, query, user] = await Promise.all([params, searchParams, getCurrentUser()]);
  const purchase = await getPurchase(id);
  if (!purchase) notFound();
  const canWrite = user?.role === "ADMIN" || user?.role === "MANAGER";
  const paymentMethods =
    canWrite && purchase.status === "DRAFT" ? await getActivePurchasePaymentMethods() : [];
  const allocated = purchase.paymentAllocations.reduce(
    (sum, row) => sum.plus(row.amount.toString()),
    new Decimal(0),
  );
  const credited = purchase.returns.reduce(
    (sum, row) => sum.plus(row.totalAmount.toString()),
    new Decimal(0),
  );
  const outstanding = Decimal.max(
    decimal(purchase.totalAmount).minus(allocated).minus(credited),
    0,
  );
  return (
    <>
      <PageHeader
        title={purchase.purchaseNumber}
        description={`${purchase.supplierNameSnapshot} • ${formatDate(purchase.purchaseDate)}`}
      />
      {query.success ? (
        <div className="alert-success" role="status">
          Purchase workflow completed successfully.
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Link className="btn-secondary" href="/purchases">
          Back to purchases
        </Link>
        <Link className="btn-secondary" href={`/suppliers/${purchase.supplierId}/account`}>
          Supplier account
        </Link>
        {canWrite && purchase.status === "DRAFT" ? (
          <Link className="btn-secondary" href={`/purchases/${purchase.id}/edit`}>
            Edit draft
          </Link>
        ) : null}
        {canWrite &&
        purchase.status === "POSTED" &&
        purchase.lots.some((lot) =>
          lot.lines.some(
            (line) =>
              line.inventoryLot && decimal(line.inventoryLot.availableQuantity).greaterThan(0),
          ),
        ) ? (
          <Link className="btn-secondary" href={`/purchases/${purchase.id}/return`}>
            Record return
          </Link>
        ) : null}
        {canWrite && purchase.status === "POSTED" ? (
          <Link
            className="btn-secondary"
            href={`/supplier-payments/new?supplierId=${purchase.supplierId}`}
          >
            Record payment
          </Link>
        ) : null}
      </div>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card-stat">
          <div className="text-xs font-semibold uppercase text-slate-500">Status</div>
          <div className="mt-2">
            <StatusBadge
              active={purchase.status === "POSTED"}
              label={businessLabel(purchase.status)}
            />
          </div>
        </div>
        <div className="card-stat">
          <div className="text-xs font-semibold uppercase text-slate-500">Payment</div>
          <div className="mt-2">
            <StatusBadge
              active={purchase.paymentStatus === "PAID"}
              label={businessLabel(purchase.paymentStatus)}
            />
          </div>
        </div>
        <div className="card-stat">
          <div className="text-xs font-semibold uppercase text-slate-500">Total</div>
          <div className="mt-1 text-lg font-bold">{formatPkr(purchase.totalAmount)}</div>
        </div>
        <div className="card-stat">
          <div className="text-xs font-semibold uppercase text-slate-500">Outstanding</div>
          <div className="mt-1 text-lg font-bold">{formatPkr(outstanding)}</div>
        </div>
      </section>
      <section className="card grid gap-5 p-6 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <div className="text-xs font-semibold uppercase text-slate-500">Supplier</div>
          <div className="mt-1 font-medium">{purchase.supplierNameSnapshot}</div>
          <div className="text-sm text-slate-500">{purchase.supplierPhoneSnapshot ?? ""}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase text-slate-500">Supplier reference</div>
          <div className="mt-1">{purchase.supplierInvoiceRef ?? "—"}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase text-slate-500">Created by</div>
          <div className="mt-1">{purchase.createdBy.name}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase text-slate-500">Subtotal</div>
          <div className="mt-1">{formatPkr(purchase.subtotal)}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase text-slate-500">Additional charges</div>
          <div className="mt-1">{formatPkr(purchase.additionalCharges)}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase text-slate-500">Notes</div>
          <div className="mt-1">{purchase.notes ?? "—"}</div>
        </div>
      </section>
      {purchase.lots.map((lot) => (
        <section className="card overflow-hidden" key={lot.id}>
          <div className="border-b border-slate-200 bg-slate-50 p-4">
            <h2 className="font-semibold">{lot.lotNumber}</h2>
            <p className="text-sm text-slate-500">
              Supplier lot: {lot.supplierLotReference ?? "—"} • Received{" "}
              {formatDate(lot.receivedAt)}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Quantity</th>
                  <th>Unit cost</th>
                  <th>Amount</th>
                  <th>Available</th>
                </tr>
              </thead>
              <tbody>
                {lot.lines.map((line) => (
                  <tr key={line.id}>
                    <td>
                      <div className="font-medium">{line.skuSnapshot}</div>
                      <div className="text-slate-500">{line.productNameSnapshot}</div>
                    </td>
                    <td>
                      {formatQuantity(line.quantity)} {line.uomCodeSnapshot}
                    </td>
                    <td>{formatPkr(line.unitPurchasePrice)}</td>
                    <td>{formatPkr(line.lineDiscountAmount)}</td>
                    <td>{formatPkr(line.unitCost)}</td>
                    <td>{formatPkr(line.lineTotal)}</td>
                    <td>
                      {line.inventoryLot
                        ? `${formatQuantity(line.inventoryLot.availableQuantity)} ${line.uomCodeSnapshot}`
                        : "Posts on approval"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      {purchase.status === "POSTED" ? (
        <section className="card overflow-x-auto">
          <div className="border-b border-slate-200 p-5">
            <h2 className="font-semibold">Settlement history</h2>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Reference</th>
                <th>Date</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {purchase.paymentAllocations.map((allocation) => (
                <tr key={allocation.id}>
                  <td>Payment</td>
                  <td>
                    {allocation.payment.paymentNumber} • {allocation.payment.paymentMethod.name}
                  </td>
                  <td>{formatDate(allocation.payment.paymentDate)}</td>
                  <td>{formatPkr(allocation.amount)}</td>
                </tr>
              ))}
              {purchase.returns.map((item) => (
                <tr key={item.id}>
                  <td>Purchase return</td>
                  <td>{item.returnNumber}</td>
                  <td>{formatDate(item.returnDate)}</td>
                  <td>{formatPkr(item.totalAmount)}</td>
                </tr>
              ))}
              {!purchase.paymentAllocations.length && !purchase.returns.length ? (
                <tr>
                  <td colSpan={4}>No payments or credits recorded.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      ) : null}
      {canWrite && purchase.status === "DRAFT" ? (
        <section className="card max-w-xl space-y-3 p-6">
          <h2 className="font-semibold">Review and post</h2>
          <p className="text-sm text-slate-600">
            Posting creates immutable inventory cost layers, inbound movements, and the supplier
            payable entry in one transaction.
          </p>
          <CommandForm
            action={postPurchaseAction.bind(null, purchase.id)}
            label="Finalize Purchase"
            confirm="Finalize this purchase? Stock and supplier balance will be updated."
          />
        </section>
      ) : null}
    </>
  );
}
