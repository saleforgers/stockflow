import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { currentBusinessDate, formatPkr } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { SummaryCards } from "@/components/ui/summary-cards";
import { decimal } from "@/lib/decimal/decimal";
import { profitAndLoss } from "@/modules/reports/queries";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireUser();
  const query = await searchParams;
  const today = currentBusinessDate();
  const from = query.from ?? today.slice(0, 7) + "-01",
    to = query.to ?? today;
  const p = await profitAndLoss(from, to);
  return (
    <>
      <PageHeader title="Profit & Loss" description={`Management report · ${from} to ${to}`} />
      <div className="flex gap-3">
        <Link className="btn-secondary" href={`?from=${today}&to=${today}`}>
          Today
        </Link>
        <Link className="btn-secondary" href={`?from=${today.slice(0, 7)}-01&to=${today}`}>
          This Month
        </Link>
      </div>
      <form className="card flex flex-wrap items-end gap-3 p-4">
        <label>
          From
          <input className="input" type="date" name="from" defaultValue={from} />
        </label>
        <label>
          To
          <input className="input" type="date" name="to" defaultValue={to} />
        </label>
        <button className="btn-primary">Apply Date Range</button>
      </form>
      <SummaryCards
        items={[
          { label: "Net Sales", value: formatPkr(p.netSales), tone: "income", direction: "up" },
          {
            label: "Gross Profit",
            value: formatPkr(p.grossProfit),
            tone: decimal(p.grossProfit).isNegative() ? "expense" : "income",
          },
          { label: "Expenses", value: formatPkr(p.expenses), tone: "expense", direction: "down" },
          {
            label: "Net Profit",
            value: formatPkr(p.netProfit),
            tone: decimal(p.netProfit).isNegative() ? "expense" : "income",
          },
        ]}
      />
      <div className="card overflow-x-auto">
        <table className="data-table">
          <tbody>
            {[
              ["Finalized Sales", p.sales],
              ["Less: Sale Returns", p.returns],
              ["Net Sales", p.netSales],
              ["Less: Cost of Goods Sold", p.cogs],
              ["Gross Profit", p.grossProfit],
              ["Less: Operating Expenses", p.expenses],
              ["Net Profit", p.netProfit],
            ].map(([label, value]) => (
              <tr key={String(label)}>
                <th>{String(label)}</th>
                <td className="text-right font-semibold">{formatPkr(value!)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-slate-500">
        Sales and returns use their business dates. Cost of goods sold uses the actual original
        stock costs, less original-cost returns. Purchases are not operating expenses. This is a
        management report, with no tax or general ledger.
      </p>
      <p className="text-sm text-slate-500">
        Stock reductions from counts, damage or loss: {formatPkr(p.stockReductions)} at original
        cost. Disclosed separately and excluded from the sales margin and net profit above.
      </p>
    </>
  );
}
