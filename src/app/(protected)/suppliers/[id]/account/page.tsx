import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth/session";
import { formatDate, formatPkr } from "@/lib/format";
import { getSupplierAccount } from "@/modules/purchases/queries";

export default async function SupplierAccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [{ id }, query, user] = await Promise.all([params, searchParams, getCurrentUser()]);
  const account = await getSupplierAccount(id);
  if (!account.supplier) notFound();
  const canWrite = user?.role === "ADMIN" || user?.role === "MANAGER";
  return (
    <>
      <PageHeader
        title={`${account.supplier.name} account`}
        description="Supplier payable, payments, advances, and deterministic ledger history."
      />
      {query.success ? (
        <div className="alert-success">Supplier payment posted successfully.</div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Link className="btn-secondary" href="/suppliers">
          Back to suppliers
        </Link>
        <Link className="btn-secondary" href={`/suppliers/${id}/account/pdf`}>
          Download PDF statement
        </Link>
        {canWrite && account.supplier.isActive ? (
          <Link className="btn-primary" href={`/supplier-payments/new?supplierId=${id}`}>
            Record payment
          </Link>
        ) : null}
      </div>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Opening balance", account.summary.openingBalance],
          ["Total purchases", account.summary.totalPurchases],
          ["Total paid", account.summary.totalPaid],
          ["Payable balance", account.summary.payableBalance],
          ["Credit / advance", account.summary.advanceBalance],
        ].map(([label, amount]) => (
          <div className="card-stat" key={label}>
            <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
            <div className="mt-1 text-lg font-bold">{formatPkr(amount)}</div>
          </div>
        ))}
      </section>
      <section className="card overflow-x-auto">
        <div className="border-b border-slate-200 p-5">
          <h2 className="font-semibold">Supplier ledger</h2>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Reference</th>
              <th>Description / Narration</th>
              <th>Debit</th>
              <th>Credit</th>
              <th>Running balance</th>
            </tr>
          </thead>
          <tbody>
            {account.statement.map((entry) => (
              <tr key={entry.id}>
                <td>{formatDate(entry.entryDate)}</td>
                <td>
                  {entry.purchase?.purchaseNumber ??
                    entry.payment?.paymentNumber ??
                    entry.purchaseReturn?.returnNumber ??
                    entry.reference ??
                    "—"}
                </td>
                <td>
                  {entry.entryType.replaceAll("_", " ")}
                  {entry.reason ? ` · ${entry.reason}` : ""}
                </td>
                <td>{entry.effect === "DECREASE" ? formatPkr(entry.amount) : "—"}</td>
                <td>{entry.effect === "INCREASE" ? formatPkr(entry.amount) : "—"}</td>
                <td>{formatPkr(entry.runningBalance)}</td>
              </tr>
            ))}
            {!account.statement.length ? (
              <tr>
                <td colSpan={6}>No ledger activity.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
      <section className="card overflow-x-auto">
        <div className="border-b border-slate-200 p-5">
          <h2 className="font-semibold">Payments</h2>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Payment</th>
              <th>Date</th>
              <th>Method</th>
              <th>Amount</th>
              <th>Unallocated</th>
            </tr>
          </thead>
          <tbody>
            {account.payments.map((payment) => (
              <tr key={payment.id}>
                <td>
                  {payment.paymentNumber}
                  <div className="text-xs text-slate-500">{payment.reference ?? ""}</div>
                </td>
                <td>{formatDate(payment.paymentDate)}</td>
                <td>{payment.paymentMethod.name}</td>
                <td>{formatPkr(payment.amount)}</td>
                <td>{formatPkr(payment.unallocated)}</td>
              </tr>
            ))}
            {!account.payments.length ? (
              <tr>
                <td colSpan={5}>No supplier payments.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </>
  );
}
