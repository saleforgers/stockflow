import Link from "next/link";

import { ConfirmForm } from "@/components/ui/confirm-form";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchFilters } from "@/components/ui/search-filters";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireUser } from "@/lib/auth/session";
import { normalizePage } from "@/lib/pagination";
import { setExpenseCategoryActiveAction } from "@/modules/expenses/actions";
import { listExpenseCategories } from "@/modules/expenses/queries";

export default async function ExpenseCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const page = normalizePage(params.page);
  const active = params.active === "true" ? true : params.active === "false" ? false : undefined;
  const result = await listExpenseCategories({ page, search: params.search, active });
  const canManage = user.role === "ADMIN";
  return (
    <>
      <PageHeader
        title="Expense Categories"
        description="Manage the categories used for operating expenses."
        actionHref={canManage ? "/expense-categories/new" : undefined}
        actionLabel="New category"
      />
      <div>
        <Link className="btn-secondary" href="/expenses">
          Expense History
        </Link>
      </div>
      {params.success ? (
        <div className="alert-success" role="status">
          Expense category saved successfully.
        </div>
      ) : null}
      <SearchFilters active={params.active} search={params.search} />
      {result.items.length === 0 ? (
        <EmptyState
          title="No expense categories found"
          description="Create a category or adjust your filters."
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Expenses</th>
                <th>Status</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((item) => (
                <tr key={item.id}>
                  <td className="font-medium text-slate-900">{item.name}</td>
                  <td>{item.description ?? "—"}</td>
                  <td>{item._count.expenses}</td>
                  <td>
                    <StatusBadge active={item.isActive} />
                  </td>
                  <td>
                    <div className="flex justify-end gap-2">
                      {canManage ? (
                        <>
                          <Link
                            className="btn-secondary text-xs"
                            href={`/expense-categories/${item.id}/edit`}
                            prefetch={false}
                          >
                            Edit
                          </Link>
                          <ConfirmForm
                            action={setExpenseCategoryActiveAction.bind(
                              null,
                              item.id,
                              !item.isActive,
                            )}
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
      <Pagination page={page} pageSize={result.pageSize} params={params} total={result.total} />
    </>
  );
}
