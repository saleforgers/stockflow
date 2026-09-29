import Link from "next/link";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchFilters } from "@/components/ui/search-filters";
import { StatusBadge } from "@/components/ui/status-badge";
import { getCurrentUser } from "@/lib/auth/session";
import { normalizePage } from "@/lib/pagination";
import { setProductActiveAction } from "@/modules/products/actions";
import { getProductFormOptions, listProducts } from "@/modules/products/queries";
export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const page = normalizePage(params.page);
  const active = params.active === "true" ? true : params.active === "false" ? false : undefined;
  const { items, total, pageSize } = await listProducts({
    search: params.search,
    active,
    categoryId: params.categoryId,
    page,
  });
  const options = await getProductFormOptions();
  const user = await getCurrentUser();
  const canEdit = user?.role === "ADMIN";
  return (
    <>
      <PageHeader
        title="Products"
        description="Each distinct stocked combination is a separate SKU. Current stock is never edited here."
        actionHref={canEdit ? "/products/new" : undefined}
        actionLabel="New product"
      />
      {params.success ? (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Product saved successfully.
        </p>
      ) : null}
      <SearchFilters active={params.active} search={params.search}>
        <label className="text-sm font-medium text-slate-700">
          Category
          <select
            className="input mt-1 min-w-44"
            defaultValue={params.categoryId ?? ""}
            name="categoryId"
          >
            <option value="">All categories</option>
            {options.categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </SearchFilters>
      {items.length === 0 ? (
        <EmptyState
          title="No products found"
          description="Create a product or adjust your filters."
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>SKU / Product</th>
                <th>Category</th>
                <th>Unit</th>
                <th>Default selling</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link
                      className="font-medium text-indigo-700 hover:underline"
                      href={`/products/${item.id}`}
                    >
                      {item.sku}
                    </Link>
                    <div className="text-slate-600">{item.name}</div>
                  </td>
                  <td>{item.category.name}</td>
                  <td>{item.inventoryUnit.code}</td>
                  <td>
                    {item.defaultSellingPrice ? `PKR ${item.defaultSellingPrice.toFixed(2)}` : "—"}
                  </td>
                  <td>
                    <StatusBadge active={item.isActive} />
                  </td>
                  <td>
                    <div className="flex justify-end gap-2">
                      {canEdit ? (
                        <>
                          <Link
                            className="btn-secondary text-xs"
                            href={`/products/${item.id}/edit`}
                          >
                            Edit
                          </Link>
                          <ConfirmForm
                            action={setProductActiveAction.bind(null, item.id, !item.isActive)}
                            label={item.isActive ? "Deactivate" : "Activate"}
                            question={`${item.isActive ? "Deactivate" : "Activate"} ${item.sku}?`}
                          />
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pageSize={pageSize} params={params} total={total} />
    </>
  );
}
