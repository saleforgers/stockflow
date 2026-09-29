import type { ActionResult } from "@/lib/actions/action-result";

export function FormMessage({ result }: { result: ActionResult }) {
  if (!result.message) return null;
  return (
    <p
      aria-live="polite"
      className={`rounded-md px-3 py-2 text-sm ${result.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}
    >
      {result.message}
    </p>
  );
}
