import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { formatPkr, formatDate } from "@/lib/format";
import { normalizePage } from "@/lib/pagination";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { documentReport, partyBalances } from "@/modules/reports/queries";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ report: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireUser();
  const [{ report }, query] = await Promise.all([params, searchParams]);
  const page = normalizePage(query.page);
  if (report === "receivables" || report === "payables") {
    const customer = report === "receivables";
    const result = await partyBalances(customer ? "customer" : "supplier", page, query.search);
    return (
      <>
        <PageHeader
          title={customer ? "Customer Receivables" : "Supplier Payables"}
          description={`Outstanding: ${formatPkr(result.outstanding)} · Credit / Advances: ${formatPkr(result.credit)}`}
        />
        <form className="flex gap-3">
          <input
            className="input max-w-sm"
            name="search"
            placeholder="Search name"
            aria-label="Search name"
            defaultValue={query.search}
          />
          <button className="btn-secondary">Search</button>
        </form>
        <div className="card overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>{customer ? "Customer" : "Supplier"}</th>
                <th>Phone</th>
                <th>Outstanding</th>
                <th>Credit</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/${customer ? "customers" : "suppliers"}/${p.id}/account`}>
                      {p.name}
                    </Link>
                  </td>
                  <td>{p.phone ?? "—"}</td>
                  <td>{p.balance.gte(0) ? formatPkr(p.balance) : "—"}</td>
                  <td>{p.balance.lt(0) ? formatPkr(p.balance.negated()) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!result.items.length && <p className="p-6">No outstanding balances.</p>}
        </div>
        <Pagination {...result} page={page} params={query} />
      </>
    );
  }
  if (report !== "sales" && report !== "purchases") notFound();
  const sale = report === "sales";
  const [result, parties, products] = await Promise.all([
    documentReport(report, {
      page,
      from: query.from,
      to: query.to,
      partyId: query.partyId,
      productId: query.productId,
      search: query.search,
    }),
    sale
      ? prisma.customer.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
      : prisma.supplier.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <>
      <PageHeader
        title={sale ? "Sales Report" : "Purchase Report"}
        description={`Finalized document total: ${formatPkr(result.amount)}. Returns are shown in transaction details; net sales are in Profit & Loss.`}
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
        <label>
          {sale ? "Customer" : "Supplier"}
          <select className="input" name="partyId" defaultValue={query.partyId}>
            <option value="">All</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Contains Product
          <select className="input" name="productId" defaultValue={query.productId}>
            <option value="">All</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <button className="btn-primary">Filter</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Date</th>
              <th>{sale ? "Customer" : "Supplier"}</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((i) => (
              <tr key={i.id}>
                <td>
                  <Link href={`/${report}/${i.id}`}>{i.number}</Link>
                </td>
                <td>{formatDate(i.date)}</td>
                <td>{i.party}</td>
                <td>{formatPkr(i.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!result.items.length && <p className="p-6">No documents in this date range.</p>}
      </div>
      <Pagination {...result} page={page} params={query} />
    </>
  );
}
