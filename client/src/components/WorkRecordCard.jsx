// Shared "one work-log registration" card — used by WorkHistory.jsx (full
// history) and WorkLog.jsx's "רשומות אחרונות" list, so both show the exact
// same layout: date+customer on one side of the header, site/building/
// employee-count on the other, and the employee list grouped by
// affiliation (pills) below it — instead of two separate designs for the
// same underlying data. `selectionControl`/`actions` are optional so a
// caller that doesn't need bulk-select (WorkHistory) or has different
// actions can omit/customize either without a second component.
export default function WorkRecordCard({
  date,
  customerName,
  siteName,
  buildingNamesText,
  employeeCount,
  affiliationGroups,
  notes,
  actions,
  selectionControl,
  className,
}) {
  return (
    <div className={`workhistory-card${className ? ` ${className}` : ""}`}>
      <div className="workhistory-card-header-row">
        {selectionControl && (
          <span className="workhistory-card-select">{selectionControl}</span>
        )}
        <div className="workhistory-card-header">
          <div className="workhistory-card-header-primary">
            <span className="workhistory-card-date" dir="ltr">
              {date}
            </span>
            <span className="workhistory-card-customer">מזמין: {customerName}</span>
          </div>

          <div className="workhistory-card-header-secondary">
            <span className="workhistory-card-site">{siteName}</span>
            {buildingNamesText && (
              <span className="workhistory-card-building">מבנה: {buildingNamesText}</span>
            )}
            <span className="workhistory-card-count">{employeeCount} עובדים</span>
          </div>

          {actions && (
            <div className="report-row-actions workhistory-card-actions">{actions}</div>
          )}
        </div>
      </div>

      <div className="workhistory-card-groups">
        {affiliationGroups.map((group, index) => (
          <div className="workhistory-card-group" key={index}>
            <span className="workhistory-card-group-label">{group.label}:</span>
            <span className="workhistory-card-group-names">
              {group.employees.map((e) => e.name).join(", ")}
            </span>
          </div>
        ))}
      </div>

      {notes && <p className="workhistory-card-notes">הערות: {notes}</p>}
    </div>
  );
}
