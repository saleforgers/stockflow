import Link from "next/link";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchFilters } from "@/components/ui/search-filters";
import { StatusBadge } from "@/components/ui/status-badge";
import { getCurrentUser } from "@/lib/auth/session";
import { normalizePage } from "@/lib/pagination";
import { setUnitActiveAction } from "@/modules/units/actions";
import { listUnits } from "@/modules/units/queries";

export default async function UnitsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const page = normalizePage(params.page);
  const active = params.active === "true" ? true : params.active === "false" ? false : undefined;
  const { items, total, pageSize } = await listUnits({ search: params.search, active, page });
  const user = await getCurrentUser();
  const canEdit = user?.role === "ADMIN";
  return (
    <>
      <PageHeader
        title="Units of measurement"
        description="Each product uses one primary inventory unit in V1."
        actionHref={canEdit ? "/units/new" : undefined}
        actionLabel="New unit"
      />
      {params.success ? (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Unit saved successfully.
        </p>
      ) : null}
      <SearchFilters active={params.active} search={params.search} />
      {items.length === 0 ? (
        <EmptyState title="No units found" description="Create a unit or adjust your filters." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Decimal scale</th>
                <th>Products</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="font-mono font-semibold">{item.code}</td>
                  <td>{item.name}</td>
                  <td>{item.decimalScale}</td>
                  <td>{item._count.products}</td>
                  <td>
                    <StatusBadge active={item.isActive} />
                  </td>
                  <td>
                    <div className="flex justify-end gap-2">
                      {canEdit ? (
                        <>
                          <Link className="btn-secondary text-xs" href={`/units/${item.id}/edit`}>
                            Edit
                          </Link>
                          <ConfirmForm
                            action={setUnitActiveAction.bind(null, item.id, !item.isActive)}
                            label={item.isActive ? "Deactivate" : "Activate"}
                            question={`${item.isActive ? "Deactivate" : "Activate"} ${item.code}?`}
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
