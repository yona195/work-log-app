import StatusBadge from "./StatusBadge.jsx";

// Compact row (name / status / actions) used inside a GroupCard for one
// child record — deliberately not a <table>, so a card with a handful of
// children doesn't need a header row and column widths of its own; it
// just reads as a short list inside the card.
export default function CompactRow({ name, archived, onEdit, onDelete, onToggleArchive }) {
  return (
    <div className="employees-row">
      <span className="employees-row-name">{name}</span>
      <StatusBadge archived={archived} />
      <div className="report-row-actions">
        <button className="edit-btn" type="button" onClick={onEdit}>
          ערוך
        </button>
        <button className="delete-btn" type="button" onClick={onDelete}>
          מחק
        </button>
        <button className="archive-btn" type="button" onClick={onToggleArchive}>
          {archived ? "שחזר" : "ארכיון"}
        </button>
      </div>
    </div>
  );
}
