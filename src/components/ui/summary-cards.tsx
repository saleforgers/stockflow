export type SummaryItem = {
  label: string;
  value: string;
  tone?: "income" | "expense" | "stock" | "warning" | "neutral";
  hint?: string;
  direction?: "up" | "down";
};
const tones = {
  income: "border-emerald-200 bg-emerald-50 text-emerald-700",
  expense: "border-rose-200 bg-rose-50 text-rose-700",
  stock: "border-indigo-200 bg-indigo-50 text-indigo-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  neutral: "border-slate-200 bg-slate-50 text-slate-600",
};
export function SummaryCards({ items, columns = 4 }: { items: SummaryItem[]; columns?: 3 | 4 }) {
  return (
    <div
      className={`grid gap-4 sm:grid-cols-2 ${columns === 3 ? "xl:grid-cols-3" : "xl:grid-cols-4"}`}
    >
      {items.map((item) => {
        const tone = item.tone ?? "neutral",
          money = item.value.startsWith("PKR ");
        return (
          <div className="card-stat min-w-0" key={item.label}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-slate-500">{item.label}</p>
              <span
                className={`grid size-9 shrink-0 place-items-center rounded-xl border text-lg font-semibold ${tones[tone]}`}
                aria-hidden="true"
              >
                {item.direction === "up"
                  ? "↗"
                  : item.direction === "down"
                    ? "↘"
                    : tone === "stock"
                      ? "▦"
                      : tone === "warning"
                        ? "!"
                        : "₨"}
              </span>
            </div>
            <p
              className={`mt-4 break-words text-2xl font-bold tracking-tight tabular-nums ${tone === "income" ? "text-emerald-700" : tone === "expense" ? "text-rose-700" : "text-slate-900"}`}
            >
              {money && <span className="mr-1.5 text-xs font-semibold text-slate-400">PKR</span>}
              {money ? item.value.slice(4) : item.value}
            </p>
            {item.hint && <p className="mt-2 text-xs text-slate-500">{item.hint}</p>}
          </div>
        );
      })}
    </div>
  );
}
