import { useEffect, useMemo, useState } from "react";
import PeriodFilter from "../components/PeriodFilter.jsx";
import EditWorkLogModal from "../components/EditWorkLogModal.jsx";
import PartialDeleteModal from "../components/PartialDeleteModal.jsx";
import WorkRecordCard from "../components/WorkRecordCard.jsx";
import { usePagedList, ListPagination } from "../components/Pagination.jsx";
import { useBulkSelection } from "../components/useBulkSelection.js";
import { useBulkOperation } from "../components/useBulkOperation.jsx";
import { useData } from "../state/DataProvider.jsx";
import { useConfirm } from "../state/ConfirmProvider.jsx";
import { useToast } from "../state/ToastProvider.jsx";
import {
  getName,
  getEmployeeIds,
  getBuildingIds,
  getBuildingNames,
  activeOnly,
  getEmployeeAffiliationName,
  groupEmployeesByAffiliation,
  isGeneralBuilding,
  getGeneralBuildingIds,
  GENERAL_BUILDING_NAME,
  GENERAL_BUILDING_FILTER_VALUE,
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

// DD.MM.YYYY, built from a plain string split (no Date object involved),
// so there is never a UTC/timezone day-shift. Kept local to this page
// since only the Work History card header uses this separator.
function formatCardDate(dateValue) {
  if (!dateValue) return "";
  const [year, month, day] = String(dateValue).split("T")[0].split("-");
  return `${day}.${month}.${year}`;
}

function toLocalIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCurrentCalendarMonthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: toLocalIsoDate(from), to: toLocalIsoDate(to) };
}

// Calendar-month based (1st of the month two months back through the last
// day of the current month) rather than a rolling "today minus 3 months"
// window — the shared PeriodFilter hook's rolling window can end up
// excluding current-month records that fall later in the month than
// today's day-of-month, which made "three months" show fewer records than
// "current month" alone. This keeps "three months" a strict superset of
// "current month" whenever no other filters are active. Kept local to
// this page (see the shared getLastThreeMonthsRange in lib/entities.js,
// used by the report pages, which is intentionally left as-is).
function getLastThreeCalendarMonthsRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: toLocalIsoDate(from), to: toLocalIsoDate(to) };
}

function useWorkHistoryDateRangeFilter() {
  const [period, setPeriod] = useState("current-month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const { from, to } = useMemo(() => {
    if (period === "current-month") return getCurrentCalendarMonthRange();
    if (period === "last-three-months") return getLastThreeCalendarMonthsRange();
    return { from: customFrom, to: customTo };
  }, [period, customFrom, customTo]);

  return { period, setPeriod, customFrom, setCustomFrom, customTo, setCustomTo, from, to };
}

export default function WorkHistory() {
  const { data, deleteItem, updateItem } = useData();
  const confirmDialog = useConfirm();
  const { showToast } = useToast();
  const { overlay: bulkOverlay, run: runBulkOperation } = useBulkOperation();
  const { subcontractors, sites, customers, buildings, employees } = data;

  const dateRange = useWorkHistoryDateRangeFilter();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [searchText, setSearchText] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [pageSize, setPageSize] = useState(5);
  const [editingLog, setEditingLog] = useState(null);
  const [partialDeleteTarget, setPartialDeleteTarget] = useState(null);
  // Every delete button here (row/bulk) is hidden until this is checked —
  // matches the same convention already used on Customers/Employees/
  // Sites/Rates/WorkLog. Named distinctly from advancedOpen above, which
  // is the unrelated "סינון נוסף" filter-panel toggle.
  const [advancedModeEnabled, setAdvancedModeEnabled] = useState(false);

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

  // With a site chosen, buildings are already scoped to it — at most one
  // real "כללי" can appear, same as any other building, no special-casing
  // needed. Without one, every site's own "כללי" would otherwise show up
  // as several visually-identical options — collapsed here into a single
  // merged option (see GENERAL_BUILDING_FILTER_VALUE) that the filtering
  // below resolves back into all of them.
  const buildingOptions = useMemo(() => {
    const active = activeOnly(buildings);
    if (filters.siteId) {
      return active.filter((b) => String(b.siteId) === String(filters.siteId));
    }
    const nonGeneral = active.filter((b) => !isGeneralBuilding(b));
    const hasGeneral = active.some(isGeneralBuilding);
    return hasGeneral
      ? [...nonGeneral, { id: GENERAL_BUILDING_FILTER_VALUE, name: GENERAL_BUILDING_NAME }]
      : nonGeneral;
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
      // The merged "כללי" option matches every site's own "כללי" building,
      // not just one — anywhere else, buildingId is a real single id.
      const matchIds =
        filters.buildingId === GENERAL_BUILDING_FILTER_VALUE
          ? getGeneralBuildingIds(buildings)
          : [String(filters.buildingId)];
      logs = logs.filter((log) =>
        getBuildingIds(log).map(String).some((id) => matchIds.includes(id))
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
  }, [data, effectiveFilters, filters.buildingId, searchText, customers, sites, buildings]);

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

  const {
    selectedIds: selectedRegistrationIds,
    toggle: toggleRegistrationSelection,
    isFullySelected: isRegistrationGroupFullySelected,
    toggleAll: toggleAllRegistrations,
    clear: clearRegistrationSelection,
  } = useBulkSelection(allRegistrations.map((r) => r.log));

  // "Select all" is scoped to the current page only, matching Rates.jsx.
  const isAllCurrentPageSelected = isRegistrationGroupFullySelected(
    pageRegistrations.map((r) => r.log)
  );
  const toggleSelectAllCurrentPage = () =>
    toggleAllRegistrations(pageRegistrations.map((r) => r.log));

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
      const name =
        filters.buildingId === GENERAL_BUILDING_FILTER_VALUE
          ? GENERAL_BUILDING_NAME
          : buildings.find((b) => String(b.id) === String(filters.buildingId))?.name;
      list.push({
        key: "building",
        label: `מבנה: ${name || "לא נמצא"}`,
        onRemove: () => setFilter("buildingId", ""),
      });
    }
    return list;
  }, [filters, subcontractors, employees, customers, sites, buildings]);

  const totalRegistrations = allRegistrations.length;

  // A record covers a full day of work at a site and can list several
  // employees/subcontractors together. Filtering by site/customer alone
  // never narrows that list (those are single-valued per record), so
  // deletion stays a plain full delete. But filtering by employee/group/
  // subcontractor can single out a subset of a record's employees —
  // getReportEmployees (shared with the report pages) already resolves
  // exactly which employees of this log match the active filters, so
  // comparing that against the log's full employee list detects any
  // filter-driven narrowing, regardless of which employee-related filter
  // caused it.
  const deleteRegistration = async (registration) => {
    const allEmployeeIds = getEmployeeIds(registration.log).map(String);
    const filteredEmployees = getReportEmployees(data, registration.log, effectiveFilters);
    const isPartial =
      filteredEmployees.length > 0 && filteredEmployees.length < allEmployeeIds.length;

    if (!isPartial) {
      if (
        await confirmDialog(
          `למחוק את הרשומה כולה (${registration.totalEmployeeCount} עובדים מכל הקבלנים)?`,
          { danger: true }
        )
      ) {
        deleteItem("workLogs", registration.log.id);
      }
      return;
    }
    setPartialDeleteTarget({ registration, filteredEmployees, allEmployeeIds });
  };

  const removeFilteredFromRegistration = async () => {
    const { registration, filteredEmployees, allEmployeeIds } = partialDeleteTarget;
    const filteredIds = new Set(filteredEmployees.map((e) => String(e.id)));
    const remainingIds = allEmployeeIds.filter((id) => !filteredIds.has(id));
    await updateItem("workLogs", registration.log.id, { employeeIds: remainingIds });
    setPartialDeleteTarget(null);
  };

  const deleteEntireRegistration = async () => {
    await deleteItem("workLogs", partialDeleteTarget.registration.log.id);
    setPartialDeleteTarget(null);
  };

  // A plain full delete per selected record — unlike the single-row
  // deleteRegistration above, this never checks for filter-driven partial
  // narrowing (matches the same simple bulk-delete behavior already used
  // for WorkLog.jsx's "רשומות אחרונות").
  const bulkDeleteSelectedRegistrations = async () => {
    const total = selectedRegistrationIds.length;
    if (!(await confirmDialog(`למחוק ${total} רשומות שנבחרו לצמיתות?`, { danger: true }))) return;
    await runBulkOperation("מוחק רשומות עבודה", total, async (setProgress) => {
      let done = 0;
      for (const id of selectedRegistrationIds) {
        // eslint-disable-next-line no-await-in-loop
        await deleteItem("workLogs", id, { silent: true }).catch(() => {});
        done += 1;
        setProgress(done);
      }
    });
    clearRegistrationSelection();
    showToast("success", `${total} רשומות עבודה נמחקו בהצלחה`);
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
            <div className="bulk-select-row">
              {advancedModeEnabled && (
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={isAllCurrentPageSelected}
                    onChange={toggleSelectAllCurrentPage}
                  />
                  <span>בחר הכל</span>
                </label>
              )}
              <label className="checkbox-item">
                <input
                  type="checkbox"
                  checked={advancedModeEnabled}
                  onChange={(e) => setAdvancedModeEnabled(e.target.checked)}
                />
                <span>מצב מתקדם</span>
              </label>
              {advancedModeEnabled && selectedRegistrationIds.length > 0 && (
                <div className="report-row-actions bulk-actions-inline">
                  <button
                    className="delete-btn"
                    type="button"
                    onClick={bulkDeleteSelectedRegistrations}
                  >
                    מחק ({selectedRegistrationIds.length})
                  </button>
                </div>
              )}
            </div>

            <div className="workhistory-cards-list">
              {pageRegistrations.map((registration) => {
                const buildingNamesText = getBuildingNames(data, registration.log);
                return (
                  <WorkRecordCard
                    key={registration.log.id}
                    date={formatCardDate(registration.log.date)}
                    customerName={getName(customers, registration.log.customerId) || "לא ידוע"}
                    siteName={getName(sites, registration.log.siteId) || "אתר לא ידוע"}
                    buildingNamesText={buildingNamesText}
                    employeeCount={registration.totalEmployeeCount}
                    affiliationGroups={registration.affiliationGroups}
                    notes={registration.log.notes}
                    selectionControl={
                      advancedModeEnabled && (
                        <input
                          type="checkbox"
                          checked={selectedRegistrationIds.includes(registration.log.id)}
                          onChange={() => toggleRegistrationSelection(registration.log.id)}
                        />
                      )
                    }
                    actions={
                      <>
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
                      </>
                    }
                  />
                );
              })}
            </div>

            <ListPagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
              startIndex={startIndex}
              totalItems={totalRegistrations}
            />
          </>
        )}
      </div>

      {editingLog && (
        <EditWorkLogModal log={editingLog} onClose={() => setEditingLog(null)} />
      )}

      {partialDeleteTarget && (
        <PartialDeleteModal
          employeeNames={partialDeleteTarget.filteredEmployees.map((e) => e.name).join(", ")}
          onRemoveFiltered={removeFilteredFromRegistration}
          onDeleteAll={deleteEntireRegistration}
          onClose={() => setPartialDeleteTarget(null)}
        />
      )}

      {bulkOverlay}
    </>
  );
}
