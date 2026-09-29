export function SearchFilters({
  search,
  active,
  children,
}: {
  search?: string;
  active?: string;
  children?: React.ReactNode;
}) {
  return (
    <form className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-end" method="get">
      <label className="min-w-0 flex-1 text-sm font-medium text-slate-700">
        Search
        <input className="input mt-1" defaultValue={search} name="search" placeholder="Search…" />
      </label>
      {children}
      <label className="text-sm font-medium text-slate-700">
        Status
        <select className="input mt-1 min-w-36" defaultValue={active ?? ""} name="active">
          <option value="">All</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </label>
      <button className="btn-secondary" type="submit">
        Apply
      </button>
    </form>
  );
}
