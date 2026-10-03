export function SummaryCards({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div className="card-stat" key={item.label}>
          <p className="text-sm text-slate-500">{item.label}</p>
          <p className="mt-2 text-xl font-semibold tabular-nums">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
