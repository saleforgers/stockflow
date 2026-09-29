import Link from "next/link";

import { ConfirmForm } from "@/components/ui/confirm-form";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchFilters } from "@/components/ui/search-filters";
import { StatusBadge } from "@/components/ui/status-badge";
import { getCurrentUser } from "@/lib/auth/session";
import { normalizePage } from "@/lib/pagination";
import { setCategoryActiveAction } from "@/modules/categories/actions";
import { listCategories } from "@/modules/categories/queries";

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const page = normalizePage(params.page);
  const active = params.active === "true" ? true : params.active === "false" ? false : undefined;
  const { items, total, pageSize } = await listCategories({
    search: params.search,
    active,
    page,
  });
  const user = await getCurrentUser();
  const canEdit = user?.role === "ADMIN";
  return (
    <>
      <PageHeader
        title="Categories"
        description="Organize products without tying the catalogue to any one industry."
        actionHref={canEdit ? "/categories/new" : undefined}
        actionLabel="New category"
      />
      {params.success ? (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Category saved successfully.
        </p>
      ) : null}
      <SearchFilters active={params.active} search={params.search} />
      {items.length === 0 ? (
        <EmptyState
          title="No categories found"
          description="Create a category or adjust your filters."
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Parent</th>
                <th>Products</th>
                <th>Status</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="font-medium text-slate-900">{item.name}</div>
                    <div className="text-xs text-slate-500">{item.slug}</div>
                  </td>
                  <td>{item.parent?.name ?? "—"}</td>
                  <td>{item._count.products}</td>
                  <td>
                    <StatusBadge active={item.isActive} />
                  </td>
                  <td>
                    <div className="flex justify-end gap-2">
                      {canEdit ? (
                        <>
                          <Link
                            className="btn-secondary text-xs"
                            href={`/categories/${item.id}/edit`}
                          >
                            Edit
                          </Link>
                          <ConfirmForm
                            action={setCategoryActiveAction.bind(null, item.id, !item.isActive)}
                            label={item.isActive ? "Deactivate" : "Activate"}
                            question={`${item.isActive ? "Deactivate" : "Activate"} ${item.name}?`}
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
