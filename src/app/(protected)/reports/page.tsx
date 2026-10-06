import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
export default async function Page() {
  await requireUser();
  return (
    <>
      <PageHeader
        title="Reports"
        description="Practical business reports using inventory and account history."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ["Sales Report", "/reports/sales", "Finalized invoices by date and customer"],
          ["Purchase Report", "/reports/purchases", "Purchases by date and supplier"],
          ["Expense Report", "/expenses", "Operating expenses by date and category"],
          ["Profit & Loss", "/reports/profit-loss", "Sales, original stock costs and expenses"],
          ["Inventory Valuation", "/inventory", "Current remaining stock at its recorded cost"],
          ["Stock Movement", "/inventory/movements", "Why each product's stock changed"],
          ["Low Stock", "/inventory/low-stock", "Products needing replenishment"],
          [
            "Customer Receivables",
            "/reports/receivables",
            "Customer outstanding and credit balances",
          ],
          ["Supplier Payables", "/reports/payables", "Supplier balances and advances"],
        ].map(([name, href, description]) => (
          <Link href={href!} key={href} className="card card-hover space-y-2 p-5">
            <h2 className="font-semibold">{name}</h2>
            <p className="text-sm text-slate-500">{description}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
