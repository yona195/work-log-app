// Shared active/archived indicator for management-page tables and lists —
// used instead of plain "פעיל"/"בארכיון" text so status reads as a
// scannable pill, consistently, everywhere a record's archived flag is
// shown.
export default function StatusBadge({ archived }) {
  return (
    <span className={`status-badge ${archived ? "status-badge-archived" : "status-badge-active"}`}>
      {archived ? "בארכיון" : "פעיל"}
    </span>
  );
}
