// Shared group-card shell — one consistent bordered card + header (icon,
// name, count pill, archived status, optional actions) for any "parent
// entity with a list of child entities inside it" page (contractors with
// their employees, sites with their buildings, ...). `groupActions` is
// optional so a fixed group with no group-level actions (e.g. "העובדים
// שלי") can render the same shell without an actions area. `selectionControl`
// is likewise optional — a leading control (e.g. a "select all in this
// group" checkbox) rendered before the icon, for pages that need one
// (e.g. Rates.jsx); omitted entirely elsewhere, so existing callers render
// exactly as before.
export default function GroupCard({
  icon,
  title,
  count,
  countLabel,
  isArchived,
  selectionControl,
  groupActions,
  children,
}) {
  return (
    <div className="employees-group-card">
      <div className="section-title-row">
        <div className="employees-group-title">
          {selectionControl}
          <span className="material-symbols-rounded employees-group-icon" aria-hidden="true">
            {icon}
          </span>
          <strong>{title}</strong>
          <span className="employees-group-count">
            {count} {countLabel}
          </span>
          {isArchived && <span className="employees-status-archived">בארכיון</span>}
        </div>
        {groupActions}
      </div>
      {children}
    </div>
  );
}
