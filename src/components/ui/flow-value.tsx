export function FlowValue({
  direction,
  children,
}: {
  direction: "in" | "out";
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-semibold tabular-nums ${direction === "in" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}
    >
      <span aria-hidden="true">{direction === "in" ? "↑" : "↓"}</span>
      <span className="sr-only">{direction === "in" ? "Increase " : "Decrease "}</span>
      {children}
    </span>
  );
}
