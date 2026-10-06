import Link from "next/link";
import { businessLabel, invoiceStatus } from "@/lib/labels";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { requireUser } from "@/lib/auth/session";
import { formatDate, formatPkr } from "@/lib/format";
import { listInvoices } from "@/modules/sales/queries";
export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const { items, total, pageSize } = await listInvoices(params.search ?? "", page);
  return (
    <>
      <PageHeader
        title="Sales invoices"
        description="Create invoices, record payments and track customer balances."
        {...(user.role !== "STAFF" ? { actionHref: "/sales/new", actionLabel: "New invoice" } : {})}
      />
      <div className="flex gap-3">
        <Link className="btn-secondary" href="/customer-ledger">
          Customer Accounts
        </Link>
        {user.role !== "STAFF" && (
          <Link className="btn-secondary" href="/customer-receipts/new">
            Record Payment
          </Link>
        )}
      </div>
      <form className="flex gap-2">
        <input
          className="input"
          name="search"
          aria-label="Search invoices"
          defaultValue={params.search}
          placeholder="Invoice number or customer"
        />
        <button className="btn-secondary">Search</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Status</th>
              <th>Total</th>
              <th>Settlement</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td>
                  <Link prefetch={false} href={`/sales/${i.id}`}>
                    {i.invoiceNumber}
                  </Link>
                </td>
                <td>{formatDate(i.invoiceDate)}</td>
                <td>{i.customerNameSnapshot}</td>
                <td>{invoiceStatus(i.status, i.paymentStatus)}</td>
                <td>{formatPkr(i.totalAmount)}</td>
                <td>{businessLabel(i.paymentStatus)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length && <p className="p-6">No invoices found.</p>}
      </div>
      <Pagination page={page} pageSize={pageSize} total={total} params={params} />
    </>
  );
}
