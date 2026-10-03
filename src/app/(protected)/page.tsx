import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { currentBusinessDate, formatDate, formatPkr } from "@/lib/format";
import { profitAndLoss, partyBalances } from "@/modules/reports/queries";
import { listStock } from "@/modules/inventory/queries";
import { StockTable } from "@/modules/inventory/views";
import { PageHeader } from "@/components/ui/page-header";
import { SummaryCards } from "@/components/ui/summary-cards";
export const metadata = { title: "Dashboard" };
export default async function Page() {
  await requireUser();
  const today = currentBusinessDate();
  const month = today.slice(0, 7) + "-01";
  const [daily, monthly, stock, low, receivables, payables, sales, purchases] = await Promise.all([
    profitAndLoss(today, today),
    profitAndLoss(month, today),
    listStock({ page: 1 }),
    listStock({ page: 1, low: true }),
    partyBalances("customer"),
    partyBalances("supplier"),
    prisma.salesInvoice.findMany({
      where: { status: "POSTED" },
      select: {
        id: true,
        invoiceNumber: true,
        invoiceDate: true,
        customerNameSnapshot: true,
        totalAmount: true,
      },
      orderBy: [{ invoiceDate: "desc" }, { id: "desc" }],
      take: 5,
    }),
    prisma.purchase.findMany({
      where: { status: "POSTED" },
      select: {
        id: true,
        purchaseNumber: true,
        purchaseDate: true,
        supplierNameSnapshot: true,
        totalAmount: true,
      },
      orderBy: [{ purchaseDate: "desc" }, { id: "desc" }],
      take: 5,
    }),
  ]);
  return (
    <>
      <PageHeader
        title="Business Overview"
        description={`Today: ${formatDate(new Date(today + "T00:00:00Z"))} · Profit and expenses show this month through today.`}
      />
      <div className="flex flex-wrap gap-3">
        <Link className="btn-primary" href="/sales/new">
          New Invoice
        </Link>
        <Link className="btn-secondary" href="/purchases/new">
          New Purchase
        </Link>
        <Link className="btn-secondary" href="/reports/profit-loss">
          Profit &amp; Loss
        </Link>
      </div>
      <SummaryCards
        items={[
          { label: "Today's Net Sales", value: formatPkr(daily.netSales) },
          { label: "This Month Net Sales", value: formatPkr(monthly.netSales) },
          { label: "Gross Profit", value: formatPkr(monthly.grossProfit) },
          { label: "Expenses", value: formatPkr(monthly.expenses) },
          { label: "Net Profit", value: formatPkr(monthly.netProfit) },
          { label: "Inventory Value", value: formatPkr(stock.totalValue) },
          { label: "Customer Receivables", value: formatPkr(receivables.outstanding) },
          { label: "Supplier Payables", value: formatPkr(payables.outstanding) },
          { label: "Low / Out of Stock", value: String(low.total) },
        ]}
      />
      <section className="space-y-3">
        <div className="flex justify-between">
          <h2 className="text-lg font-semibold">Low Stock Items</h2>
          <Link href="/inventory/low-stock">View All</Link>
        </div>
        <StockTable items={low.items.slice(0, 5)} />
      </section>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card space-y-4 p-5">
          <h2 className="font-semibold">Recent Sales</h2>
          {sales.map((i) => (
            <p className="border-t pt-3" key={i.id}>
              <Link href={`/sales/${i.id}`}>{i.invoiceNumber}</Link>
              <strong className="float-right">{formatPkr(i.totalAmount)}</strong>
              <span className="block text-sm text-slate-500">
                {i.customerNameSnapshot} · {formatDate(i.invoiceDate)}
              </span>
            </p>
          ))}
          {!sales.length && <p className="text-slate-500">No finalized invoices yet.</p>}
        </section>
        <section className="card space-y-4 p-5">
          <h2 className="font-semibold">Recent Purchases</h2>
          {purchases.map((p) => (
            <p className="border-t pt-3" key={p.id}>
              <Link href={`/purchases/${p.id}`}>{p.purchaseNumber}</Link>
              <strong className="float-right">{formatPkr(p.totalAmount)}</strong>
              <span className="block text-sm text-slate-500">
                {p.supplierNameSnapshot} · {formatDate(p.purchaseDate)}
              </span>
            </p>
          ))}
          {!purchases.length && <p className="text-slate-500">No finalized purchases yet.</p>}
        </section>
      </div>
    </>
  );
}
