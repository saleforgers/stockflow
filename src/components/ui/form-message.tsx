import type { ActionResult } from "@/lib/actions/action-result";

export function FormMessage({ result }: { result: ActionResult }) {
  if (!result.message) return null;
  return (
    <div
      aria-live="polite"
      role="alert"
      className={`flex items-start gap-2.5 rounded-lg px-4 py-3 text-sm font-medium ${
        result.ok
          ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border border-rose-200 bg-rose-50 text-rose-800"
      }`}
    >
      {result.ok ? (
        <svg
          className="mt-0.5 size-4 shrink-0"
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
      ) : (
        <svg
          className="mt-0.5 size-4 shrink-0"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clipRule="evenodd"
          />
        </svg>
      )}
      <span>{result.message}</span>
    </div>
  );
}
