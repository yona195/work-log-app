// Shared group-card shell — one consistent bordered card + header (icon,
// name, count pill, archived status, optional actions) for any "parent
// entity with a list of child entities inside it" page (contractors with
// their employees, sites with their buildings, ...). `groupActions` is
// optional so a fixed group with no group-level actions (e.g. "העובדים
// שלי") can render the same shell without an actions area.
export default function GroupCard({ icon, title, count, countLabel, isArchived, groupActions, children }) {
  return (
    <div className="employees-group-card">
      <div className="section-title-row">
        <div className="employees-group-title">
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
