import Link from "next/link";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { decimal } from "@/lib/decimal/decimal";
import { formatDate, formatPkr } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { getCustomerAccount, getSalesOptions } from "@/modules/sales/queries";
import { AdvanceForm } from "@/modules/sales/forms";
import { advanceAction } from "@/modules/sales/actions";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const account = await getCustomerAccount(id);
  if (!account?.customer) notFound();
  const writer = user.role !== "STAFF";
  const options = writer ? await getSalesOptions() : null;
  const advances = account.payments.filter((p) => decimal(p.unallocated).gt(0));
  const invoices = options?.invoices.filter((i) => i.customerId === id) ?? [];
  return (
    <>
      <PageHeader
        title={`${account.customer.name} — account`}
        description={`Receivable balance ${formatPkr(account.receivable)}. Negative balances represent customer credit.`}
      />
      {writer && (
        <Link className="btn-secondary" href={`/customer-receipts/new?customerId=${id}`}>
          Record receipt
        </Link>
      )}
      <Link className="btn-secondary" href={`/customers/${id}/account/pdf`}>
        Download PDF statement
      </Link>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Opening balance", account.summary.openingBalance],
          ["Total sales", account.summary.totalSales],
          ["Total received", account.summary.totalReceived],
          ["Outstanding", account.summary.outstanding],
          ["Credit balance", account.summary.creditBalance],
        ].map(([label, amount]) => (
          <div className="card-stat" key={label}>
            <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
            <div className="mt-1 text-lg font-bold">{formatPkr(amount)}</div>
          </div>
        ))}
      </section>
      <div className="card overflow-x-auto">
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
            {account.statement.map((e) => (
              <tr key={e.id}>
                <td>{formatDate(e.entryDate)}</td>
                <td>
                  {e.salesInvoiceId ? (
                    <Link href={`/sales/${e.salesInvoiceId}`} prefetch={false}>
                      {e.reference}
                    </Link>
                  ) : (
                    e.reference
                  )}
                </td>
                <td>
                  {e.entryType.replaceAll("_", " ")}
                  {e.reason ? ` · ${e.reason}` : ""}
                </td>
                <td>{e.effect === "INCREASE" ? formatPkr(e.amount) : "—"}</td>
                <td>{e.effect === "DECREASE" ? formatPkr(e.amount) : "—"}</td>
                <td>{formatPkr(e.runningBalance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className="text-lg font-semibold">Receipt history and advances</h2>
      <div className="card space-y-4 p-6">
        {account.payments.map((p) => (
          <div key={p.id}>
            <p>
              {p.paymentNumber} · {formatDate(p.paymentDate)} · {p.paymentMethod.name} ·{" "}
              {formatPkr(p.amount)} · Unallocated {formatPkr(p.unallocated)}
            </p>
            <p>
              {p.reference} {p.notes}
            </p>
            {p.customerAllocations.map((a) => (
              <p key={a.id}>
                <Link href={`/sales/${a.salesInvoiceId}`} prefetch={false}>
                  {a.salesInvoice.invoiceNumber}
                </Link>{" "}
                · {formatPkr(a.amount)}
              </p>
            ))}
          </div>
        ))}
      </div>
      {writer && advances.length > 0 && invoices.length > 0 && (
        <AdvanceForm
          requestKey={randomUUID()}
          action={advanceAction.bind(null, id)}
          payments={advances.map((p) => ({
            id: p.id,
            name: `${p.paymentNumber} — available PKR ${p.unallocated}`,
          }))}
          invoices={invoices.map((i) => ({
            id: i.id,
            name: `${i.invoiceNumber} — outstanding PKR ${i.outstanding}`,
          }))}
        />
      )}
    </>
  );
}
