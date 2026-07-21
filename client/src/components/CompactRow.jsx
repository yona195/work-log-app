import StatusBadge from "./StatusBadge.jsx";

// Compact row (name / status / actions) used inside a GroupCard for one
// child record — deliberately not a <table>, so a card with a handful of
// children doesn't need a header row and column widths of its own; it
// just reads as a short list inside the card. Each action button only
// renders when its handler is passed, so a caller can omit one/all of them
// for a protected/locked row (e.g. a site's default "כללי" building) without
// needing a separate "locked" prop.
export default function CompactRow({ name, archived, onEdit, onDelete, onToggleArchive }) {
  const hasActions = onEdit || onDelete || onToggleArchive;
  return (
    <div className="employees-row">
      <span className="employees-row-name">{name}</span>
      <StatusBadge archived={archived} />
      {hasActions && (
        <div className="report-row-actions">
          {onEdit && (
            <button className="edit-btn" type="button" onClick={onEdit}>
              ערוך
            </button>
          )}
          {onDelete && (
            <button className="delete-btn" type="button" onClick={onDelete}>
              מחק
            </button>
          )}
          {onToggleArchive && (
            <button className="archive-btn" type="button" onClick={onToggleArchive}>
              {archived ? "שחזר" : "ארכיון"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
