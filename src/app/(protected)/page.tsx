import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { currentBusinessDate, formatDate, formatPkr } from "@/lib/format";
import { profitAndLoss, partyBalances } from "@/modules/reports/queries";
import { listStock } from "@/modules/inventory/queries";
import { StockTable } from "@/modules/inventory/views";
import { PageHeader } from "@/components/ui/page-header";
import { SummaryCards } from "@/components/ui/summary-cards";
import { decimal } from "@/lib/decimal/decimal";
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
        columns={3}
        items={[
          {
            label: "Today's Net Sales",
            value: formatPkr(daily.netSales),
            tone: "income",
            direction: "up",
            hint: "Finalized sales less returns today",
          },
          {
            label: "This Month Net Sales",
            value: formatPkr(monthly.netSales),
            tone: "income",
            direction: "up",
            hint: "Month to date, after returns",
          },
          {
            label: "Gross Profit",
            value: formatPkr(monthly.grossProfit),
            tone: decimal(monthly.grossProfit).isNegative() ? "expense" : "income",
            hint: "Sales less original stock cost · This month",
          },
          {
            label: "Expenses",
            value: formatPkr(monthly.expenses),
            tone: "expense",
            direction: "down",
            hint: "Operating costs · This month",
          },
          {
            label: "Net Profit",
            value: formatPkr(monthly.netProfit),
            tone: decimal(monthly.netProfit).isNegative() ? "expense" : "income",
            hint: "Gross profit less expenses · This month",
          },
          {
            label: "Inventory Value",
            value: formatPkr(stock.totalValue),
            tone: "stock",
            hint: "Value of remaining stock at its original cost",
          },
        ]}
      />
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Accounts &amp; Stock Alerts</h2>
        <SummaryCards
          columns={3}
          items={[
            {
              label: "Customers Owe You",
              value: formatPkr(receivables.outstanding),
              tone: "warning",
              hint: "Outstanding customer invoices",
            },
            {
              label: "You Owe Suppliers",
              value: formatPkr(payables.outstanding),
              tone: "expense",
              hint: "Outstanding supplier purchases",
            },
            {
              label: "Low / Out of Stock",
              value: String(low.total),
              tone: "warning",
              hint: "Products at or below their reorder threshold",
            },
          ]}
        />
      </section>
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
