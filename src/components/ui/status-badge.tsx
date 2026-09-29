export function StatusBadge({ active, label }: { active: boolean; label?: string }) {
  return (
    <span className={`status-badge ${active ? "status-active" : "status-inactive"}`}>
      {label ?? (active ? "Active" : "Inactive")}
    </span>
  );
}
