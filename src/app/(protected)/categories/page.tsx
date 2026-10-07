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

  const [categoriesResult, user] = await Promise.all([
    listCategories({
      search: params.search,
      active,
      page,
    }),
    getCurrentUser(),
  ]);

  const { items, total, pageSize } = categoriesResult;
  const canEdit = user?.role === "ADMIN";
  return (
    <>
      <PageHeader
        title="Categories"
        description="Organize your products into catalog categories."
        actionHref={canEdit ? "/categories/new" : undefined}
        actionLabel="New category"
      />
      {params.success ? (
        <div className="alert-success" role="status">
          <svg
            className="size-4 shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          Category saved successfully.
        </div>
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
                            prefetch={false}
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
