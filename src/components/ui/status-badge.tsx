export function StatusBadge({ active, label }: { active: boolean; label?: string }) {
  return (
    <span className={`status-badge ${active ? "status-active" : "status-inactive"}`}>
      <span
        className="mr-1.5 inline-block size-1.5 rounded-full"
        style={{ background: active ? "#059669" : "#94a3b8" }}
        aria-hidden="true"
      />
      {label ?? (active ? "Active" : "Inactive")}
    </span>
  );
}
