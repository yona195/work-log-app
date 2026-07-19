import { useMemo, useState } from "react";
import PeriodFilter, { useDateRangeFilter } from "../components/PeriodFilter.jsx";
import { useData } from "../state/DataProvider.jsx";
import {
  getEmployeeAffiliationName,
  isEmployeeArchived,
  activeOnly,
} from "../lib/entities.js";
import { filterReportLogs, getReportEmployees } from "../lib/reports.js";
import { createWorkLogPDF, createFinancialSummaryPDF } from "../lib/pdf.js";
import { exportToExcel, exportFinancialSummaryToExcel } from "../lib/excel.js";

const EMPTY_FILTERS = {
  group: "",
  subcontractorId: "",
  employeeId: "",
  siteId: "",
  customerId: "",
};

export default function Reports() {
  const { data } = useData();
  const { subcontractors, sites, customers, employees } = data;

  const dateRange = useDateRangeFilter();
  const [reportType, setReportType] = useState("customer"); // "customer" | "employer"
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [showArchived, setShowArchived] = useState(false);

  const setFilter = (key, value) =>
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      // Mirror legacy behaviour: internal group clears/locks the subcontractor.
      if (key === "group" && value === "internal") next.subcontractorId = "";
      return next;
    });

  // Archived employees/subcontractors/sites/customers are hidden from these
  // filter lists by default so they don't clutter the common case; the
  // "הצג פריטים בארכיון" checkbox brings them back for pulling a report
  // that includes someone/something no longer active.
  const visibleSubcontractors = showArchived ? subcontractors : activeOnly(subcontractors);
  const visibleSites = showArchived ? sites : activeOnly(sites);
  const visibleCustomers = showArchived ? customers : activeOnly(customers);

  const employeeOptions = useMemo(() => {
    return employees.filter((employee) => {
      if (!showArchived && isEmployeeArchived(employee, subcontractors)) return false;
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
  }, [employees, subcontractors, filters.group, filters.subcontractorId, showArchived]);

  const effectiveFilters = useMemo(
    () => ({ ...filters, from: dateRange.from, to: dateRange.to }),
    [filters, dateRange.from, dateRange.to]
  );

  const filteredLogs = useMemo(
    () => filterReportLogs(data, effectiveFilters),
    [data, effectiveFilters]
  );

  const reportEmployeesFor = (log) => getReportEmployees(data, log, effectiveFilters);

  const handlePDF = () => {
    if (filteredLogs.length === 0) {
      alert("אין רשומות מתאימות להפקת PDF");
      return;
    }
    createWorkLogPDF(data, filteredLogs, reportEmployeesFor);
  };

  const handleExcel = () => exportToExcel(data, filteredLogs, reportEmployeesFor);

  const handleEmployerPDF = () => {
    if (filteredLogs.length === 0) {
      alert("אין רשומות מתאימות להפקת PDF");
      return;
    }
    createFinancialSummaryPDF(data, filteredLogs, effectiveFilters);
  };

  const handleEmployerExcel = () =>
    exportFinancialSummaryToExcel(data, filteredLogs, effectiveFilters);

  // The only mandatory field on this page — every narrowing filter below is
  // legitimately optional (empty = "everyone"/"everything"), but a custom
  // period with a missing endpoint is a genuinely incomplete selection.
  const periodValid =
    dateRange.period !== "custom" || Boolean(dateRange.customFrom && dateRange.customTo);
  const canExport = periodValid;

  return (
    <>
      <div className="card">
        <h3>הגדרת הדוח</h3>

        <div className="filter-grid">
          <div className="filter-grid-item">
            <PeriodFilter
              period={dateRange.period}
              onPeriodChange={dateRange.setPeriod}
              customFrom={dateRange.customFrom}
              customTo={dateRange.customTo}
              onCustomFromChange={dateRange.setCustomFrom}
              onCustomToChange={dateRange.setCustomTo}
              required
              errorMessage={periodValid ? "" : "יש לבחור טווח תאריכים מלא"}
            />
          </div>

          <div className="filter-grid-item">
            <label>מזמין עבודה</label>
            <select
              value={filters.customerId}
              onChange={(e) => setFilter("customerId", e.target.value)}
            >
              <option value="">כל המזמינים</option>
              {visibleCustomers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                  {customer.archived ? " (בארכיון)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-grid-item">
            <label>אתר עבודה</label>
            <select
              value={filters.siteId}
              onChange={(e) => setFilter("siteId", e.target.value)}
            >
              <option value="">כל האתרים</option>
              {visibleSites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                  {site.archived ? " (בארכיון)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-grid-item">
            <label>שיוך עובדים</label>
            <select
              value={filters.group}
              onChange={(e) => setFilter("group", e.target.value)}
            >
              <option value="">כל העובדים</option>
              <option value="internal">העובדים שלי</option>
              <option value="all-subcontractors">כל עובדי קבלני המשנה</option>
            </select>
          </div>

          <div className="filter-grid-item">
            <label>קבלן משנה</label>
            <select
              value={filters.subcontractorId}
              disabled={filters.group === "internal"}
              onChange={(e) => setFilter("subcontractorId", e.target.value)}
            >
              <option value="">כל קבלני המשנה</option>
              {visibleSubcontractors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.archived ? " (בארכיון)" : ""}
                </option>
              ))}
            </select>
          </div>

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
                  {isEmployeeArchived(employee, subcontractors) ? " (בארכיון)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-grid-item">
            <label className="checkbox-item" style={{ display: "inline-flex", marginTop: 8 }}>
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
              <span>הצג פריטים בארכיון ברשימות הסינון</span>
            </label>
          </div>
        </div>

        <label style={{ marginTop: 20 }}>סוג הדוח</label>
        <div className="employee-actions">
          <button
            type="button"
            className={reportType === "customer" ? "primary-btn" : "secondary-btn"}
            onClick={() => setReportType("customer")}
          >
            דוח מזמין
          </button>
          <button
            type="button"
            className={reportType === "employer" ? "primary-btn" : "secondary-btn"}
            onClick={() => setReportType("employer")}
          >
            דוח מעסיק
          </button>
        </div>

        <div className="report-actions">
          <button
            className="primary-btn"
            type="button"
            disabled={!canExport}
            onClick={reportType === "customer" ? handlePDF : handleEmployerPDF}
          >
            ייצוא PDF
          </button>
          <button
            className="excel-btn"
            type="button"
            disabled={!canExport}
            onClick={reportType === "customer" ? handleExcel : handleEmployerExcel}
          >
            ייצוא אקסל
          </button>
        </div>
      </div>
    </>
  );
}
