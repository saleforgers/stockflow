import Link from "next/link";

import { pageCount } from "@/lib/pagination";

export function Pagination({
  page,
  total,
  pageSize,
  params,
}: {
  page: number;
  total: number;
  pageSize: number;
  params: Record<string, string | undefined>;
}) {
  const pages = pageCount(total, pageSize);
  if (pages <= 1) return null;
  const href = (next: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
    query.set("page", String(next));
    return `?${query.toString()}`;
  };
  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between text-sm text-slate-600"
    >
      <span>
        Page {page} of {pages} · {total} records
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link className="btn-secondary" href={href(page - 1)}>
            Previous
          </Link>
        ) : null}
        {page < pages ? (
          <Link className="btn-secondary" href={href(page + 1)}>
            Next
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
