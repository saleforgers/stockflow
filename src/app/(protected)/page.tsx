import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth/session";

export default async function DashboardPlaceholderPage() {
  const user = await requireUser();
  return (
    <>
      <PageHeader
        title={`Welcome, ${user.name}`}
        description="StockFlow master data is ready. Transaction dashboards and analytics arrive in later phases."
      />
      <section className="card p-6">
        <h2 className="font-semibold text-slate-900">Phase 1B workspace</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Use the navigation to manage products, categories, units, suppliers, and customers. No
          stock, balance, purchase, or sales figures are shown because posting workflows are
          intentionally not implemented yet.
        </p>
      </section>
    </>
  );
}
