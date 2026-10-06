import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { normalizePage } from "@/lib/pagination";
import { formatDate, formatPkr } from "@/lib/format";
import { businessLabel } from "@/lib/labels";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { listEstimates } from "@/modules/estimates/queries";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const query = await searchParams;
  const page = normalizePage(query.page);
  const result = await listEstimates(page, query.search);
  return (
    <>
      <PageHeader
        title="Estimates / Quotations"
        description="Prepare prices for customers. Estimates do not change inventory or account balances."
        {...(user.role !== "STAFF"
          ? { actionHref: "/estimates/new", actionLabel: "New Estimate" }
          : {})}
      />
      <form className="flex gap-3">
        <input
          className="input max-w-sm"
          name="search"
          aria-label="Search estimates"
          placeholder="Estimate number or customer"
          defaultValue={query.search}
        />
        <button className="btn-secondary">Search</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Estimate</th>
              <th>Customer</th>
              <th>Date</th>
              <th>Valid Until</th>
              <th>Status</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((e) => (
              <tr key={e.id}>
                <td>
                  <Link href={`/estimates/${e.id}`}>{e.estimateNumber}</Link>
                </td>
                <td>{e.customerNameSnapshot}</td>
                <td>{formatDate(e.estimateDate)}</td>
                <td>{e.validUntil ? formatDate(e.validUntil) : "—"}</td>
                <td>{businessLabel(e.status)}</td>
                <td>{formatPkr(e.totalAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!result.items.length && (
          <p className="p-6">No estimates yet. Create a quotation for a customer.</p>
        )}
      </div>
      <Pagination {...result} page={page} params={query} />
    </>
  );
}
