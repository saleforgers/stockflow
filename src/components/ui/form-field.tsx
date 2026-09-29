import type { ReactNode } from "react";

export function FormField({
  label,
  htmlFor,
  hint,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold text-slate-800" htmlFor={htmlFor}>
        {label}{" "}
        {required ? (
          <span className="text-rose-500" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children}
      {hint ? (
        <p className="flex items-start gap-1.5 text-xs leading-5 text-slate-500" id={`${htmlFor}-hint`}>
          <svg className="mt-0.5 size-3 shrink-0 text-slate-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
