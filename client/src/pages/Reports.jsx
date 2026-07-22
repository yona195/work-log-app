import { useEffect, useMemo, useState } from "react";
import { useDateRangeFilter } from "../components/PeriodFilter.jsx";
import DatePicker from "../components/DatePicker.jsx";
import WorkforceSelectionFields from "../components/WorkforceSelectionFields.jsx";
import { useData } from "../state/DataProvider.jsx";
import {
  getEmployeeAffiliationName,
  isEmployeeArchived,
  activeOnly,
} from "../lib/entities.js";
import { filterReportLogs, getReportEmployees } from "../lib/reports.js";
import { buildWorkLogReportHtml, buildEmployerReportHtml } from "../lib/pdf.js";
import { exportToExcel, exportFinancialSummaryToExcel } from "../lib/excel.js";
import { exportPdfDirect } from "../lib/pdfExport.js";

const toggle = (list, id) =>
  list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

export default function Reports() {
  const { data } = useData();
  const { subcontractors, sites, customers, employees } = data;

  const dateRange = useDateRangeFilter();
  const [reportType, setReportType] = useState("customer"); // "customer" | "employer"
  const [siteId, setSiteId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [group, setGroup] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [contractorSearch, setContractorSearch] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);

  // Empty means "unrestricted" (matches the field's original single-select
  // "כל העובדים/כל קבלני המשנה" default) — only once something is actually
  // checked does the report narrow to just those. Kept as arrays (rather
  // than a single id) so the report can be scoped to several specific
  // employees/contractors at once, same as the worklog/employee-reports
  // selection panels.
  const [selectedSubcontractorIds, setSelectedSubcontractorIds] = useState([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);

  // Switching workforce type invalidates whatever contractor/employee was
  // picked under the previous type — never leave a hidden filter active.
  const changeWorkforceType = (value) => {
    setGroup(value);
    setSelectedSubcontractorIds([]);
    setSelectedEmployeeIds([]);
  };

  const toggleSubcontractor = (id) => setSelectedSubcontractorIds(toggle(selectedSubcontractorIds, id));
  const toggleEmployee = (id) => setSelectedEmployeeIds(toggle(selectedEmployeeIds, id));

  // A subcontractor selection change can make the previous employee
  // selection stale (ids no longer in employeeOptions) — start over empty.
  useEffect(() => {
    setSelectedEmployeeIds([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group, selectedSubcontractorIds]);

  // Archived employees/subcontractors/sites/customers are hidden from these
  // filter lists by default so they don't clutter the common case; the
  // "הצג גם פריטים מהארכיון" checkbox brings them back for pulling a report
  // that includes someone/something no longer active.
  const visibleSites = showArchived ? sites : activeOnly(sites);
  const visibleCustomers = showArchived ? customers : activeOnly(customers);

  const relevantSubcontractors = useMemo(() => {
    if (group !== "all-subcontractors") return [];
    const idsWithEmployees = new Set(
      employees
        .filter((e) => e.type !== "internal")
        .map((e) => String(e.subcontractorId || ""))
    );
    const text = contractorSearch.trim().toLowerCase();
    return subcontractors.filter(
      (s) =>
        idsWithEmployees.has(String(s.id)) &&
        (showArchived || !s.archived) &&
        (!text || s.name.toLowerCase().includes(text))
    );
  }, [subcontractors, employees, group, showArchived, contractorSearch]);

  const employeeOptions = useMemo(() => {
    const text = employeeSearch.trim().toLowerCase();
    return employees.filter((employee) => {
      if (!showArchived && isEmployeeArchived(employee, subcontractors)) return false;
      const isInternal = employee.type === "internal";
      const isSub = employee.type === "subcontractor" || employee.type === "external";
      if (group === "internal" && !isInternal) return false;
      if (group === "all-subcontractors") {
        if (!isSub) return false;
        if (!selectedSubcontractorIds.includes(String(employee.subcontractorId || "")))
          return false;
      }
      if (text && !employee.name.toLowerCase().includes(text)) return false;
      return true;
    });
  }, [employees, subcontractors, group, selectedSubcontractorIds, showArchived, employeeSearch]);

  const effectiveFilters = useMemo(
    () => ({
      from: dateRange.from,
      to: dateRange.to,
      group,
      subcontractorId: selectedSubcontractorIds.length > 0 ? selectedSubcontractorIds : "",
      employeeId: selectedEmployeeIds.length > 0 ? selectedEmployeeIds : "",
      siteId,
      customerId,
    }),
    [dateRange.from, dateRange.to, group, selectedSubcontractorIds, selectedEmployeeIds, siteId, customerId]
  );

  const filteredLogs = useMemo(
    () => filterReportLogs(data, effectiveFilters),
    [data, effectiveFilters]
  );

  const reportEmployeesFor = (log) => getReportEmployees(data, log, effectiveFilters);

  const handlePDF = () =>
    exportPdfDirect({
      hasData: filteredLogs.length > 0,
      logs: filteredLogs,
      filenamePrefix: "יומן_עבודה",
      buildHtml: () =>
        buildWorkLogReportHtml(data, filteredLogs, reportEmployeesFor, { autoPrint: false }),
      onLoadingChange: setPdfLoading,
    });

  const handleExcel = () => exportToExcel(data, filteredLogs, reportEmployeesFor);

  const handleEmployerPDF = () =>
    exportPdfDirect({
      hasData: filteredLogs.length > 0,
      logs: filteredLogs,
      filenamePrefix: "דוח_מעסיק",
      buildHtml: () =>
        buildEmployerReportHtml(data, filteredLogs, effectiveFilters, { autoPrint: false }),
      onLoadingChange: setPdfLoading,
    });

  const handleEmployerExcel = () =>
    exportFinancialSummaryToExcel(data, filteredLogs, effectiveFilters);

  // The only mandatory field on this page — every narrowing filter below is
  // legitimately optional (empty = "everyone"/"everything"), but a custom
  // period with a missing endpoint is a genuinely incomplete selection.
  const periodValid =
    dateRange.period !== "custom" || Boolean(dateRange.customFrom && dateRange.customTo);
  const canExport = periodValid;

  const employeeLabel = (employee) =>
    `${employee.name} - ${getEmployeeAffiliationName(data, employee)}${
      isEmployeeArchived(employee, subcontractors) ? " (בארכיון)" : ""
    }`;

  const selectedEmployeeItems = employees
    .filter((e) => selectedEmployeeIds.includes(e.id))
    .map((e) => ({ id: e.id, label: employeeLabel(e) }));

  return (
    <div className="card">
      <div className="card-header-select-row">
        <h3>הגדרת הדוח</h3>
        <select
          className="card-header-select"
          value={dateRange.period}
          onChange={(e) => dateRange.setPeriod(e.target.value)}
        >
          <option value="current-month">החודש הנוכחי</option>
          <option value="last-three-months">שלושה חודשים אחרונים</option>
          <option value="custom">בחירת תאריך</option>
        </select>
      </div>

      {dateRange.period === "custom" && (
        <div style={{ marginBottom: 18 }}>
          <label>טווח תאריכים</label>
          <DatePicker
            mode="range"
            value={{ from: dateRange.customFrom, to: dateRange.customTo }}
            onChange={({ from, to }) => {
              dateRange.setCustomFrom(from);
              dateRange.setCustomTo(to);
            }}
          />
          {!periodValid && <p className="field-error">יש לבחור טווח תאריכים מלא</p>}
        </div>
      )}

      <div className="form-section">
        <h4 className="form-section-title">היקף הדוח</h4>
        <div className="filter-grid filter-grid-2">
          <div className="filter-grid-item">
            <label>מזמין עבודה</label>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
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
            <select value={siteId} onChange={(e) => setSiteId(e.target.value)}>
              <option value="">כל האתרים</option>
              {visibleSites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                  {site.archived ? " (בארכיון)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="form-section">
        <h4 className="form-section-title">כוח אדם בדוח</h4>
        <WorkforceSelectionFields
          group={group}
          onGroupChange={changeWorkforceType}
          contractorSearch={contractorSearch}
          onContractorSearchChange={setContractorSearch}
          contractorItems={relevantSubcontractors.map((s) => ({
            id: s.id,
            label: `${s.name}${s.archived ? " (בארכיון)" : ""}`,
          }))}
          selectedContractorIds={selectedSubcontractorIds}
          onToggleContractor={toggleSubcontractor}
          onSelectAllContractors={() =>
            setSelectedSubcontractorIds((prev) => [
              ...new Set([...prev, ...relevantSubcontractors.map((s) => s.id)]),
            ])
          }
          onClearAllContractors={() => setSelectedSubcontractorIds([])}
          employeeSearch={employeeSearch}
          onEmployeeSearchChange={setEmployeeSearch}
          employeeItems={employeeOptions.map((employee) => ({
            id: employee.id,
            label: employeeLabel(employee),
          }))}
          selectedEmployeeIds={selectedEmployeeIds}
          onToggleEmployee={toggleEmployee}
          onSelectAllEmployees={() =>
            setSelectedEmployeeIds((prev) => [
              ...new Set([...prev, ...employeeOptions.map((e) => e.id)]),
            ])
          }
          onClearAllEmployees={() => setSelectedEmployeeIds([])}
          selectedEmployeeItems={selectedEmployeeItems}
        />
      </div>

      <hr className="form-divider" />

      <div className="form-section">
        <div className="section-title-row">
          <h4 className="form-section-title" style={{ marginBottom: 0 }}>הפקת הדוח</h4>
          <label className="checkbox-item" style={{ display: "inline-flex" }}>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            <span>הצג גם פריטים מהארכיון</span>
          </label>
        </div>

        <label>סוג הדוח</label>
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
            className="pdf-btn"
            type="button"
            disabled={!canExport || pdfLoading}
            onClick={reportType === "customer" ? handlePDF : handleEmployerPDF}
          >
            <span className="material-symbols-rounded" aria-hidden="true">
              picture_as_pdf
            </span>
            {pdfLoading ? "מכין את הקובץ..." : "ייצוא PDF"}
          </button>
          <button
            className="excel-btn"
            type="button"
            disabled={!canExport}
            onClick={reportType === "customer" ? handleExcel : handleEmployerExcel}
          >
            <span className="material-symbols-rounded" aria-hidden="true">
              table_view
            </span>
            ייצוא אקסל
          </button>
        </div>
      </div>
    </div>
  );
}
