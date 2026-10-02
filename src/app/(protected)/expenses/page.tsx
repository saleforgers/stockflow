import Link from "next/link";

import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { requireUser } from "@/lib/auth/session";
import { formatDate, formatPkr } from "@/lib/format";
import { normalizePage } from "@/lib/pagination";
import { getExpenseFilterOptions, listExpenses } from "@/modules/expenses/queries";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const page = normalizePage(params.page);
  const status = params.status === "POSTED" || params.status === "VOID" ? params.status : undefined;
  const [result, options] = await Promise.all([
    listExpenses({
      page,
      search: params.search,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      categoryId: params.categoryId,
      paymentMethodId: params.paymentMethodId,
      status,
    }),
    getExpenseFilterOptions(),
  ]);
  const canWrite = user.role === "ADMIN" || user.role === "MANAGER";
  return (
    <>
      <PageHeader
        title="Expenses"
        description="Operating expenses kept separate from purchases, inventory and FIFO costing."
        actionHref={canWrite ? "/expenses/new" : undefined}
        actionLabel="Add Expense"
      />
      <div className="flex gap-3">
        <Link className="btn-secondary" href="/expense-categories">
          Expense Categories
        </Link>
      </div>
      {params.success ? (
        <div className="alert-success" role="status">
          Expense saved successfully.
        </div>
      ) : null}
      <form className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4" method="get">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Search
          <input
            className="input mt-1.5"
            defaultValue={params.search}
            name="search"
            placeholder="Number, description, payee…"
          />
        </label>
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          From
          <input
            className="input mt-1.5"
            defaultValue={params.dateFrom}
            name="dateFrom"
            type="date"
          />
        </label>
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          To
          <input className="input mt-1.5" defaultValue={params.dateTo} name="dateTo" type="date" />
        </label>
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Category
          <select className="input mt-1.5" defaultValue={params.categoryId ?? ""} name="categoryId">
            <option value="">All categories</option>
            {options.categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Payment Method
          <select
            className="input mt-1.5"
            defaultValue={params.paymentMethodId ?? ""}
            name="paymentMethodId"
          >
            <option value="">All methods</option>
            {options.paymentMethods.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Status
          <select className="input mt-1.5" defaultValue={params.status ?? ""} name="status">
            <option value="">All statuses</option>
            <option value="POSTED">Posted</option>
            <option value="VOID">Void</option>
          </select>
        </label>
        <div className="flex items-end">
          <button className="btn-primary" type="submit">
            Filter
          </button>
        </div>
      </form>
      <div className="card p-5">
        <p className="text-sm text-slate-500">Filtered posted expense total</p>
        <p className="mt-1 text-2xl font-bold text-slate-900">{formatPkr(result.filteredAmount)}</p>
      </div>
      {result.items.length === 0 ? (
        <EmptyState
          title="No expenses found"
          description="Add an expense or adjust your filters."
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Expense</th>
                <th>Category</th>
                <th>Description</th>
                <th>Payment Method</th>
                <th>Paid To</th>
                <th>Amount</th>
                <th>Created by</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((item) => (
                <tr key={item.id}>
                  <td>{formatDate(item.expenseDate)}</td>
                  <td>
                    <Link prefetch={false} href={`/expenses/${item.id}`}>
                      {item.expenseNumber}
                    </Link>
                  </td>
                  <td>{item.expenseCategory.name}</td>
                  <td>{item.description}</td>
                  <td>{item.paymentMethod.name}</td>
                  <td>{item.payeeName ?? "—"}</td>
                  <td>{formatPkr(item.amount)}</td>
                  <td>{item.createdBy.name}</td>
                  <td>{item.status}</td>
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
