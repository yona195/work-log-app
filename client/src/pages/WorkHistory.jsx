import { useEffect, useMemo, useState } from "react";
import PeriodFilter, { useDateRangeFilter } from "../components/PeriodFilter.jsx";
import EditWorkLogModal from "../components/EditWorkLogModal.jsx";
import { usePagedList } from "../components/Pagination.jsx";
import { useData } from "../state/DataProvider.jsx";
import { formatExcelDate } from "../lib/format.js";
import {
  getName,
  getBuildingIds,
  getBuildingNames,
  activeOnly,
  getEmployeeAffiliationName,
} from "../lib/entities.js";
import { filterReportLogs, getReportEmployees } from "../lib/reports.js";

const EMPTY_FILTERS = {
  group: "",
  subcontractorId: "",
  employeeId: "",
  siteId: "",
  customerId: "",
  buildingId: "",
};

// Splits a log's employees into one group per affiliation (internal /
// each subcontractor) so the card shows "who worked for whom" instead of
// one flat name list — this is display grouping only, the underlying
// registration is still the single log it always was.
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
  const { subcontractors, sites, customers, buildings, employees } = data;

  const dateRange = useDateRangeFilter();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [searchText, setSearchText] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [pageSize, setPageSize] = useState(5);
  const [editingLog, setEditingLog] = useState(null);

  const setFilter = (key, value) =>
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      // Mirror legacy behaviour: internal group clears/locks the subcontractor.
      if (key === "group" && value === "internal") next.subcontractorId = "";
      if (key === "group" && value !== "all-subcontractors") next.subcontractorId = "";
      return next;
    });

  const clearAllFilters = () => {
    setFilters(EMPTY_FILTERS);
    setSearchText("");
  };

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

  // Narrows the site/building dropdowns to what's actually relevant given
  // the customer/site already picked — based on real history (workLogs),
  // not a new schema relationship. Falls back to the full list once
  // nothing is picked yet.
  const siteOptions = useMemo(() => {
    if (!filters.customerId) return activeOnly(sites);
    const relatedSiteIds = new Set(
      (data.workLogs || [])
        .filter((log) => String(log.customerId) === String(filters.customerId))
        .map((log) => String(log.siteId))
    );
    return activeOnly(sites).filter((s) => relatedSiteIds.has(String(s.id)));
  }, [sites, data.workLogs, filters.customerId]);

  const buildingOptions = useMemo(() => {
    if (!filters.siteId) return activeOnly(buildings);
    return activeOnly(buildings).filter((b) => String(b.siteId) === String(filters.siteId));
  }, [buildings, filters.siteId]);

  const effectiveFilters = useMemo(
    () => ({ ...filters, from: dateRange.from, to: dateRange.to }),
    [filters, dateRange.from, dateRange.to]
  );

  // filterReportLogs (shared with the report pages) doesn't know about
  // buildingId, so that narrowing — and the free-text search — happen here
  // as plain client-side post-filters instead of touching the shared
  // function's signature.
  const filteredLogs = useMemo(() => {
    let logs = filterReportLogs(data, effectiveFilters);
    if (filters.buildingId) {
      logs = logs.filter((log) =>
        getBuildingIds(log).map(String).includes(String(filters.buildingId))
      );
    }
    const text = searchText.trim().toLowerCase();
    if (text) {
      logs = logs.filter((log) => {
        const reportEmployees = getReportEmployees(data, log, effectiveFilters);
        const haystack = [
          ...reportEmployees.map((e) => e.name),
          ...reportEmployees.map((e) => getEmployeeAffiliationName(data, e)),
          getName(customers, log.customerId),
          getName(sites, log.siteId),
          getBuildingNames(data, log),
          log.notes,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(text);
      });
    }
    return logs;
  }, [data, effectiveFilters, filters.buildingId, searchText, customers, sites]);

  // Each log row already IS one original registration — grouping here
  // means "one card per log", never merging separate logs that merely
  // share a date/site/customer. Newest first.
  const allRegistrations = useMemo(() => {
    const sorted = [...filteredLogs].sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return sorted.map((log) => {
      const reportEmployees = getReportEmployees(data, log, effectiveFilters);
      return {
        log,
        totalEmployeeCount: reportEmployees.length,
        affiliationGroups: groupEmployeesByAffiliation(data, reportEmployees),
      };
    });
  }, [filteredLogs, data, effectiveFilters]);

  const {
    pageItems: pageRegistrations,
    page,
    setPage,
    totalPages,
    startIndex,
  } = usePagedList(allRegistrations, pageSize);

  // Any filter (or page-size) change invalidates the current page index.
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveFilters, filters.buildingId, searchText, pageSize]);

  const chips = useMemo(() => {
    const list = [];
    if (filters.group) {
      list.push({
        key: "group",
        label: `שיוך עובדים: ${
          filters.group === "internal" ? "העובדים שלי" : "כל עובדי קבלני המשנה"
        }`,
        onRemove: () => setFilter("group", ""),
      });
    }
    if (filters.subcontractorId) {
      const name = subcontractors.find((s) => String(s.id) === String(filters.subcontractorId))?.name;
      list.push({
        key: "subcontractor",
        label: `קבלן משנה: ${name || "לא נמצא"}`,
        onRemove: () => setFilter("subcontractorId", ""),
      });
    }
    if (filters.employeeId) {
      const name = employees.find((e) => String(e.id) === String(filters.employeeId))?.name;
      list.push({
        key: "employee",
        label: `עובד: ${name || "לא נמצא"}`,
        onRemove: () => setFilter("employeeId", ""),
      });
    }
    if (filters.customerId) {
      const name = customers.find((c) => String(c.id) === String(filters.customerId))?.name;
      list.push({
        key: "customer",
        label: `מזמין: ${name || "לא נמצא"}`,
        onRemove: () => setFilter("customerId", ""),
      });
    }
    if (filters.siteId) {
      const name = sites.find((s) => String(s.id) === String(filters.siteId))?.name;
      list.push({
        key: "site",
        label: `אתר: ${name || "לא נמצא"}`,
        onRemove: () => setFilter("siteId", ""),
      });
    }
    if (filters.buildingId) {
      const name = buildings.find((b) => String(b.id) === String(filters.buildingId))?.name;
      list.push({
        key: "building",
        label: `מבנה: ${name || "לא נמצא"}`,
        onRemove: () => setFilter("buildingId", ""),
      });
    }
    return list;
  }, [filters, subcontractors, employees, customers, sites, buildings]);

  const totalRegistrations = allRegistrations.length;
  const rangeStart = totalRegistrations === 0 ? 0 : startIndex + 1;
  const rangeEnd = Math.min(startIndex + pageSize, totalRegistrations);

  const deleteRegistration = (registration) => {
    if (
      confirm(
        `למחוק את הרשומה כולה (${registration.totalEmployeeCount} עובדים מכל הקבלנים)?`
      )
    ) {
      deleteItem("workLogs", registration.log.id);
    }
  };

  return (
    <>
      <div className="card">
        <h3>סינון היסטוריה</h3>

        <div className="filter-grid filter-grid-2">
          <div className="filter-grid-item">
            <PeriodFilter
              period={dateRange.period}
              onPeriodChange={dateRange.setPeriod}
              customFrom={dateRange.customFrom}
              customTo={dateRange.customTo}
              onCustomFromChange={dateRange.setCustomFrom}
              onCustomToChange={dateRange.setCustomTo}
            />
          </div>
          <div className="filter-grid-item">
            <label>חיפוש חופשי</label>
            <input
              type="text"
              placeholder="🔍 חפש לפי עובד, קבלן, מזמין, אתר או מבנה..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>
        </div>

        <button
          type="button"
          className="secondary-btn advanced-filters-toggle"
          onClick={() => setAdvancedOpen((open) => !open)}
        >
          {advancedOpen ? "הסתר סינון נוסף ▲" : "סינון נוסף ▼"}
        </button>

        {advancedOpen && (
          <div className="filter-grid filter-grid-3" style={{ marginTop: 14 }}>
            <div className="filter-grid-item">
              <label>שיוך עובדים</label>
              <select value={filters.group} onChange={(e) => setFilter("group", e.target.value)}>
                <option value="">כל העובדים</option>
                <option value="internal">העובדים שלי</option>
                <option value="all-subcontractors">כל עובדי קבלני המשנה</option>
              </select>
            </div>

            {filters.group === "all-subcontractors" && (
              <div className="filter-grid-item">
                <label>קבלן משנה</label>
                <select
                  value={filters.subcontractorId}
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
              </div>
            )}

            <div className="filter-grid-item">
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
            </div>

            <div className="filter-grid-item">
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

            <div className="filter-grid-item">
              <label>אתר עבודה</label>
              <select value={filters.siteId} onChange={(e) => setFilter("siteId", e.target.value)}>
                <option value="">כל האתרים</option>
                {siteOptions.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                    {site.archived ? " (בארכיון)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-grid-item">
              <label>מבנה</label>
              <select
                value={filters.buildingId}
                onChange={(e) => setFilter("buildingId", e.target.value)}
              >
                <option value="">כל המבנים</option>
                {buildingOptions.map((building) => (
                  <option key={building.id} value={building.id}>
                    {building.name}
                    {building.archived ? " (בארכיון)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {chips.length > 0 && (
          <div className="filter-chips" style={{ marginTop: 14 }}>
            {chips.map((chip) => (
              <span className="filter-chip" key={chip.key}>
                {chip.label}
                <button
                  type="button"
                  className="filter-chip-remove"
                  onClick={chip.onRemove}
                  aria-label="הסר סינון"
                >
                  ×
                </button>
              </span>
            ))}
            <button type="button" className="secondary-btn" onClick={clearAllFilters}>
              נקה את כל הסינונים
            </button>
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h2>היסטוריית עבודה</h2>

        {totalRegistrations === 0 ? (
          <p>אין רשומות מתאימות.</p>
        ) : (
          <>
            <div className="workhistory-cards-list">
              {pageRegistrations.map((registration) => {
                const buildingNamesText = getBuildingNames(data, registration.log);
                return (
                  <div key={registration.log.id} className="workhistory-card">
                    <div className="workhistory-card-header">
                      <span className="workhistory-card-date" dir="ltr">
                        {formatExcelDate(registration.log.date)}
                      </span>
                      <span className="workhistory-card-site">
                        {getName(sites, registration.log.siteId) || "אתר לא ידוע"}
                      </span>
                      {buildingNamesText && (
                        <span className="workhistory-card-building">מבנה: {buildingNamesText}</span>
                      )}
                      <span className="workhistory-card-customer">
                        מזמין: {getName(customers, registration.log.customerId) || "לא ידוע"}
                      </span>
                      <span className="workhistory-card-count">
                        {registration.totalEmployeeCount} עובדים
                      </span>

                      <div className="report-row-actions workhistory-card-actions">
                        <button
                          className="edit-btn"
                          type="button"
                          onClick={() => setEditingLog(registration.log)}
                        >
                          עריכה
                        </button>
                        <button
                          className="delete-btn"
                          type="button"
                          onClick={() => deleteRegistration(registration)}
                        >
                          מחיקה
                        </button>
                      </div>
                    </div>

                    <div className="workhistory-card-groups">
                      {registration.affiliationGroups.map((group, index) => (
                        <div className="workhistory-card-group" key={index}>
                          <span className="workhistory-card-group-label">{group.label}:</span>
                          <span className="workhistory-card-group-names">
                            {group.employees.map((e) => e.name).join(", ")}
                          </span>
                        </div>
                      ))}
                    </div>

                    {registration.log.notes && (
                      <p className="workhistory-card-notes">הערות: {registration.log.notes}</p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="workhistory-pagination">
              <div className="workhistory-page-size">
                <span>רשומות בעמוד:</span>
                {[5, 10, 20, 50].map((size) => (
                  <button
                    key={size}
                    type="button"
                    className={pageSize === size ? "primary-btn" : "secondary-btn"}
                    onClick={() => setPageSize(size)}
                  >
                    {size}
                  </button>
                ))}
              </div>

              <div className="workhistory-page-nav">
                <span className="workhistory-page-info">
                  מציג {rangeStart}–{rangeEnd} מתוך {totalRegistrations} רשומות
                </span>
                <div className="pagination-nav-group">
                  <button
                    type="button"
                    className="pagination-nav"
                    onClick={() => setPage(page - 1)}
                    disabled={page <= 1}
                    aria-label="עמוד קודם"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="pagination-nav"
                    onClick={() => setPage(page + 1)}
                    disabled={page >= totalPages}
                    aria-label="עמוד הבא"
                  >
                    ›
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {editingLog && (
        <EditWorkLogModal log={editingLog} onClose={() => setEditingLog(null)} />
      )}
    </>
  );
}
