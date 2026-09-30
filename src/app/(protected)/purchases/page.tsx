import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchFilters } from "@/components/ui/search-filters";
import { StatusBadge } from "@/components/ui/status-badge";
import { getCurrentUser } from "@/lib/auth/session";
import { formatDate, formatPkr } from "@/lib/format";
import { normalizePage } from "@/lib/pagination";
import { getSupplierFilterOptions, listPurchases } from "@/modules/purchases/queries";

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const status =
    params.status === "DRAFT" || params.status === "POSTED" || params.status === "VOID"
      ? params.status
      : undefined;
  const [result, suppliers, user] = await Promise.all([
    listPurchases({
      search: params.search,
      status,
      supplierId: params.supplierId,
      page: normalizePage(params.page),
    }),
    getSupplierFilterOptions(),
    getCurrentUser(),
  ]);
  const canWrite = user?.role === "ADMIN" || user?.role === "MANAGER";
  const page = normalizePage(params.page);
  return (
    <>
      <PageHeader
        title="Purchases"
        description="Create supplier bills, receive stock, and manage payable settlement."
        actionHref={canWrite ? "/purchases/new" : undefined}
        actionLabel="New purchase"
      />
      <div className="flex flex-wrap gap-2">
        <Link className="btn-secondary" href="/supplier-payments/new">
          Record supplier payment
        </Link>
      </div>
      <SearchFilters search={params.search}>
        <label className="text-sm font-medium text-slate-700">
          Status
          <select className="input mt-1 min-w-36" defaultValue={params.status ?? ""} name="status">
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="POSTED">Posted</option>
            <option value="VOID">Void</option>
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Supplier
          <select
            className="input mt-1 min-w-48"
            defaultValue={params.supplierId ?? ""}
            name="supplierId"
          >
            <option value="">All suppliers</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </label>
      </SearchFilters>
      {result.items.length === 0 ? (
        <EmptyState
          title="No purchases found"
          description="Create a draft purchase or adjust your filters."
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Purchase</th>
                <th>Supplier</th>
                <th>Date</th>
                <th>Total</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link
                      className="font-semibold text-indigo-700 hover:underline"
                      href={`/purchases/${item.id}`}
                      prefetch={false}
                    >
                      {item.purchaseNumber}
                    </Link>
                    <div className="text-xs text-slate-500">
                      {item.supplierInvoiceRef ?? "No supplier reference"}
                    </div>
                  </td>
                  <td>{item.supplier.name}</td>
                  <td>{formatDate(item.purchaseDate)}</td>
                  <td>{formatPkr(item.totalAmount)}</td>
                  <td>
                    <StatusBadge active={item.status === "POSTED"} label={item.status} />
                  </td>
                  <td>
                    <StatusBadge
                      active={item.paymentStatus === "PAID"}
                      label={item.paymentStatus.replaceAll("_", " ")}
                    />
                  </td>
                  <td>{formatPkr(item.outstanding)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pageSize={result.pageSize} params={params} total={result.total} />
    </>
  );
}
