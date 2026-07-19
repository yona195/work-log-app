import { useMemo, useState } from "react";
import PeriodFilter, { useDateRangeFilter } from "../components/PeriodFilter.jsx";
import EditWorkLogModal from "../components/EditWorkLogModal.jsx";
import { useData } from "../state/DataProvider.jsx";
import { formatExcelDate } from "../lib/format.js";
import { getName, getBuildingNames, getEmployeeAffiliationName } from "../lib/entities.js";
import { filterReportLogs, getReportEmployees, groupLogsByMonth } from "../lib/reports.js";

const EMPTY_FILTERS = {
  group: "",
  subcontractorId: "",
  employeeId: "",
  siteId: "",
  customerId: "",
};

// Splits a log's employees into one group per affiliation (internal /
// each subcontractor) so a row never mixes employees from different
// contractors — makes it obvious at a glance who worked for whom.
function groupEmployeesByAffiliation(data, reportEmployees) {
  const groups = new Map();
  reportEmployees.forEach((employee) => {
    const key =
      employee.type === "internal" ? "internal" : String(employee.subcontractorId || "");
    if (!groups.has(key)) {
      groups.set(key, {
        label: getEmployeeAffiliationName(data, employee),
        employees: [],
      });
    }
    groups.get(key).employees.push(employee);
  });
  return Array.from(groups.values());
}

export default function WorkHistory() {
  const { data, deleteItem } = useData();
  const { subcontractors, sites, customers, employees } = data;

  const dateRange = useDateRangeFilter();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [editingLog, setEditingLog] = useState(null);

  const setFilter = (key, value) =>
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      // Mirror legacy behaviour: internal group clears/locks the subcontractor.
      if (key === "group" && value === "internal") next.subcontractorId = "";
      return next;
    });

  const employeeOptions = useMemo(() => {
    return employees.filter((employee) => {
      const isInternal = employee.type === "internal";
      const isSub = employee.type === "subcontractor" || employee.type === "external";
      let matchesGroup = true;
      if (filters.group === "internal") matchesGroup = isInternal;
      if (filters.group === "all-subcontractors") matchesGroup = isSub;
      const matchesSub =
        !filters.subcontractorId ||
        String(employee.subcontractorId || "") === String(filters.subcontractorId);
      return matchesGroup && matchesSub;
    });
  }, [employees, filters.group, filters.subcontractorId]);

  const effectiveFilters = useMemo(
    () => ({ ...filters, from: dateRange.from, to: dateRange.to }),
    [filters, dateRange.from, dateRange.to]
  );

  const filteredLogs = useMemo(
    () => filterReportLogs(data, effectiveFilters),
    [data, effectiveFilters]
  );

  const reportEmployeesFor = (log) => getReportEmployees(data, log, effectiveFilters);

  // groupLogsByMonth (shared with the PDF/Excel exports, which want
  // chronological order) returns oldest-first — reverse both the months
  // and the days within each month here so the page itself reads
  // newest-first without touching that shared ordering.
  const monthGroups = useMemo(() => {
    const ascending = groupLogsByMonth(filteredLogs);
    return [...ascending].reverse().map((group) => ({
      ...group,
      logs: [...group.logs].reverse(),
    }));
  }, [filteredLogs]);

  return (
    <>
      <div className="card">
        <h3>סינון היסטוריה</h3>

        <PeriodFilter
          period={dateRange.period}
          onPeriodChange={dateRange.setPeriod}
          customFrom={dateRange.customFrom}
          customTo={dateRange.customTo}
          onCustomFromChange={dateRange.setCustomFrom}
          onCustomToChange={dateRange.setCustomTo}
        />

        <label>שיוך עובדים</label>
        <select
          value={filters.group}
          onChange={(e) => setFilter("group", e.target.value)}
        >
          <option value="">כל העובדים</option>
          <option value="internal">העובדים שלי</option>
          <option value="all-subcontractors">כל עובדי קבלני המשנה</option>
        </select>

        <label>קבלן משנה</label>
        <select
          value={filters.subcontractorId}
          disabled={filters.group === "internal"}
          onChange={(e) => setFilter("subcontractorId", e.target.value)}
        >
          <option value="">כל קבלני המשנה</option>
          {subcontractors.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.archived ? " (בארכיון)" : ""}
            </option>
          ))}
        </select>

        <label>עובד</label>
        <select
          value={filters.employeeId}
          onChange={(e) => setFilter("employeeId", e.target.value)}
        >
          <option value="">כל העובדים</option>
          {employeeOptions.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name} - {getEmployeeAffiliationName(data, employee)}
              {employee.archived ? " (בארכיון)" : ""}
            </option>
          ))}
        </select>

        <label>אתר עבודה</label>
        <select
          value={filters.siteId}
          onChange={(e) => setFilter("siteId", e.target.value)}
        >
          <option value="">כל האתרים</option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
              {site.archived ? " (בארכיון)" : ""}
            </option>
          ))}
        </select>

        <label>מזמין עבודה</label>
        <select
          value={filters.customerId}
          onChange={(e) => setFilter("customerId", e.target.value)}
        >
          <option value="">כל המזמינים</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
              {customer.archived ? " (בארכיון)" : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h2>היסטוריית עבודה</h2>
        <p>סה״כ רשומות: {filteredLogs.length}</p>
        {filteredLogs.length === 0 ? (
          <p>אין רשומות מתאימות.</p>
        ) : (
          monthGroups.map((group) => (
            <div key={group.key} style={{ marginTop: 20 }}>
              <h3>{group.label}</h3>
              <table>
                <thead>
                  <tr>
                    <th>תאריך</th>
                    <th>עובדים</th>
                    <th>קבלן</th>
                    <th>סה״כ עובדים</th>
                    <th>אתר</th>
                    <th>מבנה</th>
                    <th>מזמין</th>
                    <th>הערות</th>
                    <th className="actions-column">פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {group.logs.flatMap((log) => {
                    const reportEmployees = reportEmployeesFor(log);
                    const affiliationGroups = groupEmployeesByAffiliation(
                      data,
                      reportEmployees
                    );
                    // Every split row still edits/deletes the whole log entry
                    // (all affiliations together) — there's only one
                    // underlying record, just displayed as several rows. The
                    // accent bar marks them as belonging to the same entry
                    // when a log actually got split into more than one row.
                    const isSplit = affiliationGroups.length > 1;
                    return affiliationGroups.map((affiliationGroup, index) => (
                      <tr key={`${log.id}-${index}`} className={isSplit ? "history-split-row" : undefined}>
                        <td dir="ltr">{formatExcelDate(log.date)}</td>
                        <td>{affiliationGroup.employees.map((e) => e.name).join(", ")}</td>
                        <td>{affiliationGroup.label}</td>
                        <td>{affiliationGroup.employees.length}</td>
                        <td>{getName(sites, log.siteId)}</td>
                        <td>{getBuildingNames(data, log)}</td>
                        <td>{getName(customers, log.customerId)}</td>
                        <td>{log.notes || ""}</td>
                        <td>
                          <div className="report-row-actions">
                            <button
                              className="edit-btn"
                              type="button"
                              onClick={() => setEditingLog(log)}
                            >
                              ערוך
                            </button>
                            <button
                              className="delete-btn"
                              type="button"
                              onClick={() => {
                                if (
                                  confirm(
                                    `למחוק את הרשומה כולה (${reportEmployees.length} עובדים מכל הקבלנים)?`
                                  )
                                ) {
                                  deleteItem("workLogs", log.id);
                                }
                              }}
                            >
                              מחק
                            </button>
                          </div>
                        </td>
                      </tr>
                    ));
                  })}
                </tbody>
              </table>
            </div>
          ))
        )}
      </div>

      {editingLog && (
        <EditWorkLogModal log={editingLog} onClose={() => setEditingLog(null)} />
      )}
    </>
  );
}
