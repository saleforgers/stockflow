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

  const hasPrev = page > 1;
  const hasNext = page < pages;

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between border-t border-slate-100 pt-4 text-sm text-slate-600"
    >
      <span className="text-xs text-slate-500">
        Page <span className="font-semibold text-slate-700">{page}</span> of{" "}
        <span className="font-semibold text-slate-700">{pages}</span>
        <span className="mx-1.5">·</span>
        <span className="font-semibold text-slate-700">{total}</span> records
      </span>
      <div className="flex gap-2">
        {hasPrev ? (
          <Link className="btn-secondary" href={href(page - 1)} aria-label="Previous page">
            <svg
              className="size-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Previous
          </Link>
        ) : null}
        {hasNext ? (
          <Link className="btn-secondary" href={href(page + 1)} aria-label="Next page">
            Next
            <svg
              className="size-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
