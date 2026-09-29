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
      <div className="relative min-w-0 flex-1">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500" htmlFor="search-input">
          Search
        </label>
        <div className="relative mt-1.5">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <svg className="size-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            className="input pl-9"
            defaultValue={search}
            id="search-input"
            name="search"
            placeholder="Search…"
          />
        </div>
      </div>
      {children}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500" htmlFor="status-filter">
          Status
        </label>
        <select className="input mt-1.5 min-w-36" defaultValue={active ?? ""} id="status-filter" name="active">
          <option value="">All statuses</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>
      <button className="btn-primary shrink-0" type="submit" id="apply-filters">
        <svg className="size-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        Filter
      </button>
    </form>
  );
}
