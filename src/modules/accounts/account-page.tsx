import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { formatPkr, formatDate } from "@/lib/format";
import { businessLabel } from "@/lib/labels";
import { normalizePage } from "@/lib/pagination";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SummaryCards } from "@/components/ui/summary-cards";
import { getStatement } from "./queries";
export async function AccountPage({
  id,
  kind,
  query,
}: {
  id: string;
  kind: "customer" | "supplier";
  query: Record<string, string | undefined>;
}) {
  const user = await requireUser();
  const page = normalizePage(query.page);
  const account = await getStatement(kind, id, { page, from: query.from, to: query.to });
  if (!account) notFound();
  const customer = kind === "customer";
  const base = customer ? "customers" : "suppliers";
  const filters = new URLSearchParams();
  if (query.from) filters.set("from", query.from);
  if (query.to) filters.set("to", query.to);
  return (
    <>
      <PageHeader
        title={`${account.party.name} — ${customer ? "Customer" : "Supplier"} Account`}
        description={[account.party.phone, account.party.address].filter(Boolean).join(" · ")}
      />
      <div className="flex flex-wrap gap-3">
        <Link className="btn-secondary" href={`/${base}/${id}/account/pdf?${filters}`}>
          Download Statement PDF
        </Link>
        {user.role !== "STAFF" && account.party.isActive && (
          <Link
            className="btn-primary"
            href={`/${customer ? "customer-receipts" : "supplier-payments"}/new?${customer ? "customerId" : "supplierId"}=${id}`}
          >
            Record Payment
          </Link>
        )}
        {customer && (
          <Link className="btn-secondary" href={`/customers/${id}/advances`}>
            Payments &amp; Advances
          </Link>
        )}
      </div>
      <SummaryCards
        items={[
          {
            label: customer ? "Total Sales" : "Total Purchases",
            value: formatPkr(account.transactions),
          },
          { label: customer ? "Total Received" : "Total Paid", value: formatPkr(account.payments) },
          {
            label: customer ? "Outstanding" : "Payable Balance",
            value: formatPkr(account.outstanding),
          },
          { label: "Credit Balance", value: formatPkr(account.credit) },
        ]}
      />
      <form className="card flex flex-wrap items-end gap-3 p-4">
        <label>
          From
          <input className="input" type="date" name="from" defaultValue={query.from} />
        </label>
        <label>
          To
          <input className="input" type="date" name="to" defaultValue={query.to} />
        </label>
        <button className="btn-secondary">Filter Statement</button>
      </form>
      <p>
        Opening Balance: <strong>{formatPkr(account.opening)}</strong> · Closing Balance:{" "}
        <strong>{formatPkr(account.closing)}</strong>
      </p>
      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Reference</th>
              <th>Description</th>
              <th>{customer ? "Invoice / Debit" : "Purchase / Debit"}</th>
              <th>Payment / Credit</th>
              <th>Running Balance</th>
            </tr>
          </thead>
          <tbody>
            {account.rows.map((e) => (
              <tr key={e.id}>
                <td>{formatDate(e.entryDate)}</td>
                <td>
                  {e.documentId ? (
                    <Link href={`/${customer ? "sales" : "purchases"}/${e.documentId}`}>
                      {e.reference}
                    </Link>
                  ) : (
                    (e.reference ?? "—")
                  )}
                </td>
                <td>
                  {businessLabel(e.entryType)}
                  {e.reason && <p className="text-xs text-slate-500">{e.reason}</p>}
                </td>
                <td>{e.effect === "INCREASE" ? formatPkr(e.amount) : "—"}</td>
                <td>{e.effect === "DECREASE" ? formatPkr(e.amount) : "—"}</td>
                <td>{formatPkr(e.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!account.rows.length && (
          <p className="p-6 text-slate-500">No account activity in this date range.</p>
        )}
      </div>
      <Pagination page={page} total={account.total} pageSize={account.pageSize} params={query} />
      <p className="text-sm text-slate-500">
        Summary cards show the complete account. The statement uses your selected dates. A negative
        statement balance means credit held on the account.
      </p>
    </>
  );
}
