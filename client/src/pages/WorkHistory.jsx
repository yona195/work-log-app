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

const PAGE_SIZE = 20;
// Cycled per split log entry (not per row) so two adjacent split groups
// never land on the same color and blend together.
const SPLIT_COLOR_COUNT = 4;

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
  const [pageByMonth, setPageByMonth] = useState({});

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

  // Pre-splits every log into its affiliation-group rows and assigns each
  // split entry a cycling color class, so rendering below is just a plain
  // slice-and-map (needed for pagination) without recomputing any of this.
  const monthSections = useMemo(() => {
    let splitLogCounter = -1;
    return monthGroups.map((group) => ({
      key: group.key,
      label: group.label,
      rows: group.logs.flatMap((log) => {
        const reportEmployees = getReportEmployees(data, log, effectiveFilters);
        const affiliationGroups = groupEmployeesByAffiliation(data, reportEmployees);
        const isSplit = affiliationGroups.length > 1;
        if (isSplit) splitLogCounter += 1;
        const colorClass = isSplit
          ? `history-split-row-${splitLogCounter % SPLIT_COLOR_COUNT}`
          : undefined;
        return affiliationGroups.map((affiliationGroup, index) => ({
          rowKey: `${log.id}-${index}`,
          log,
          totalEmployeeCount: reportEmployees.length,
          affiliationGroup,
          colorClass,
        }));
      }),
    }));
  }, [monthGroups, data, effectiveFilters]);

  const getPage = (monthKey) => pageByMonth[monthKey] || 1;
  const setPage = (monthKey, page) =>
    setPageByMonth((prev) => ({ ...prev, [monthKey]: page }));

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
          monthSections.map((section) => {
            const totalPages = Math.max(1, Math.ceil(section.rows.length / PAGE_SIZE));
            const page = Math.min(getPage(section.key), totalPages);
            const pageRows = section.rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

            return (
              <div key={section.key} style={{ marginTop: 20 }}>
                <h3>{section.label}</h3>
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
                    {pageRows.map((row) => (
                      <tr key={row.rowKey} className={row.colorClass}>
                        <td dir="ltr">{formatExcelDate(row.log.date)}</td>
                        <td>{row.affiliationGroup.employees.map((e) => e.name).join(", ")}</td>
                        <td>{row.affiliationGroup.label}</td>
                        <td>{row.affiliationGroup.employees.length}</td>
                        <td>{getName(sites, row.log.siteId)}</td>
                        <td>{getBuildingNames(data, row.log)}</td>
                        <td>{getName(customers, row.log.customerId)}</td>
                        <td>{row.log.notes || ""}</td>
                        <td>
                          <div className="report-row-actions">
                            <button
                              className="edit-btn"
                              type="button"
                              onClick={() => setEditingLog(row.log)}
                            >
                              ערוך
                            </button>
                            <button
                              className="delete-btn"
                              type="button"
                              onClick={() => {
                                if (
                                  confirm(
                                    `למחוק את הרשומה כולה (${row.totalEmployeeCount} עובדים מכל הקבלנים)?`
                                  )
                                ) {
                                  deleteItem("workLogs", row.log.id);
                                }
                              }}
                            >
                              מחק
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {totalPages > 1 && (
                  <div className="pagination">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNumber) => (
                      <button
                        key={pageNumber}
                        type="button"
                        className={
                          pageNumber === page ? "pagination-btn active" : "pagination-btn"
                        }
                        onClick={() => setPage(section.key, pageNumber)}
                      >
                        {(pageNumber - 1) * PAGE_SIZE + 1}-
                        {Math.min(pageNumber * PAGE_SIZE, section.rows.length)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {editingLog && (
        <EditWorkLogModal log={editingLog} onClose={() => setEditingLog(null)} />
      )}
    </>
  );
}
