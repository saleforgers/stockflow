import Link from "next/link";

export function PageHeader({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">{description}</p>
        ) : null}
      </div>
      {actionHref && actionLabel ? (
        <Link
          className="btn-primary shrink-0"
          href={actionHref}
          id={`action-${actionLabel.toLowerCase().replace(/\s+/g, "-")}`}
        >
          <svg
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          {actionLabel}
        </Link>
      ) : null}
    </header>
  );
}
