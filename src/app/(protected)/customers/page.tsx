import Link from "next/link";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchFilters } from "@/components/ui/search-filters";
import { StatusBadge } from "@/components/ui/status-badge";
import { getCurrentUser } from "@/lib/auth/session";
import { normalizePage } from "@/lib/pagination";
import { setCustomerActiveAction } from "@/modules/customers/actions";
import { listCustomers } from "@/modules/customers/queries";
export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const page = normalizePage(params.page);
  const active = params.active === "true" ? true : params.active === "false" ? false : undefined;

  const [customersResult, user] = await Promise.all([
    listCustomers({ search: params.search, active, page }),
    getCurrentUser(),
  ]);

  const { items, total, pageSize } = customersResult;
  const canEdit = user?.role === "ADMIN";
  return (
    <>
      <PageHeader
        title="Customers"
        description="Manage customer accounts, contact details, and client information."
        actionHref={canEdit ? "/customers/new" : undefined}
        actionLabel="New customer"
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
          Customer saved successfully.
        </div>
      ) : null}
      <SearchFilters active={params.active} search={params.search} />
      {items.length === 0 ? (
        <EmptyState
          title="No customers found"
          description="Create a customer or adjust your filters."
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">{item.name}</span>
                      {item.isWalkIn ? <StatusBadge active label="System" /> : null}
                    </div>
                  </td>
                  <td>{item.phone ?? "—"}</td>
                  <td>{item.email ?? "—"}</td>
                  <td>
                    <StatusBadge active={item.isActive} />
                  </td>
                  <td>
                    <div className="flex justify-end gap-2">
                      <Link
                        className="btn-secondary text-xs"
                        href={`/customers/${item.id}/account`}
                        prefetch={false}
                      >
                        Account
                      </Link>
                      {canEdit && !item.isWalkIn ? (
                        <>
                          <Link
                            className="btn-secondary text-xs"
                            href={`/customers/${item.id}/edit`}
                            prefetch={false}
                          >
                            Edit
                          </Link>
                          <ConfirmForm
                            action={setCustomerActiveAction.bind(null, item.id, !item.isActive)}
                            label={item.isActive ? "Deactivate" : "Activate"}
                            question={`${item.isActive ? "Deactivate" : "Activate"} ${item.name}?`}
                          />
                        </>
                      ) : item.isWalkIn ? (
                        <span className="text-xs text-slate-500">Protected</span>
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
