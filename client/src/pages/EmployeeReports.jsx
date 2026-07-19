import { useEffect, useMemo, useState } from "react";
import { useData } from "../state/DataProvider.jsx";
import {
  getEmployeeAffiliationName,
  isEmployeeArchived,
} from "../lib/entities.js";
import { filterReportLogs } from "../lib/reports.js";
import { buildEmployeeReportHtml } from "../lib/pdf.js";
import { exportEmployeeWorkExcel, exportEmployeeSummaryExcel } from "../lib/excel.js";
import PeriodFilter, { useDateRangeFilter } from "../components/PeriodFilter.jsx";
import Dropdown from "../components/Dropdown.jsx";
import { exportPdfInNewTab, NO_DATA_MESSAGE } from "../lib/pdfExport.js";

const toggle = (list, id) =>
  list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

export default function EmployeeReports() {
  const { data } = useData();
  const { employees, subcontractors } = data;

  const dateRange = useDateRangeFilter();
  const [reportType, setReportType] = useState("work"); // "work" | "summary"
  const [group, setGroup] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);

  // Starts empty on purpose — nothing is pre-checked; the user picks what
  // they want. An empty array means "match nothing" (no report yet) until
  // something is checked, rather than silently defaulting to "everyone".
  const [selectedSubcontractorIds, setSelectedSubcontractorIds] = useState([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);

  const handleGroupChange = (value) => {
    setGroup(value);
    setSelectedSubcontractorIds([]);
    setSelectedEmployeeIds([]);
  };

  const relevantSubcontractors = useMemo(() => {
    if (group !== "all-subcontractors") return [];
    const idsWithEmployees = new Set(
      employees
        .filter((e) => e.type !== "internal")
        .map((e) => String(e.subcontractorId || ""))
    );
    return subcontractors.filter(
      (s) => idsWithEmployees.has(String(s.id)) && (showArchived || !s.archived)
    );
  }, [subcontractors, employees, group, showArchived]);

  const toggleSubcontractor = (id) => {
    setSelectedSubcontractorIds(toggle(selectedSubcontractorIds, id));
  };

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

  // A subcontractor selection change can make the previous employee
  // selection stale (ids no longer in employeeOptions) — start over empty.
  useEffect(() => {
    setSelectedEmployeeIds([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group, selectedSubcontractorIds]);

  const toggleEmployee = (id) => {
    setSelectedEmployeeIds(toggle(selectedEmployeeIds, id));
  };

  const filters = useMemo(
    () => ({
      from: dateRange.from,
      to: dateRange.to,
      group,
      subcontractorId: group === "all-subcontractors" ? selectedSubcontractorIds : "",
      employeeId: selectedEmployeeIds,
    }),
    [dateRange.from, dateRange.to, group, selectedSubcontractorIds, selectedEmployeeIds]
  );

  const filteredLogs = useMemo(
    () => filterReportLogs(data, filters),
    [data, filters]
  );

  const requireLogs = (fn) => () => {
    if (filteredLogs.length === 0) {
      alert(NO_DATA_MESSAGE);
      return;
    }
    fn(data, filteredLogs, filters);
  };

  const handleWorkExcel = requireLogs(exportEmployeeWorkExcel);
  const handleSummaryExcel = requireLogs(exportEmployeeSummaryExcel);

  const openEmployeePdfPreview = (includeFinance) =>
    exportPdfInNewTab({
      hasData: filteredLogs.length > 0,
      buildHtml: () =>
        buildEmployeeReportHtml(data, filteredLogs, filters, {
          includeFinance,
          autoPrint: false,
        }),
      onLoadingChange: setPdfLoading,
    });

  const handleWorkPDF = () => openEmployeePdfPreview(false);
  const handleSummaryPDF = () => openEmployeePdfPreview(true);

  // Mandatory fields: a complete period, and at least one employee selected
  // (selection starts empty by design, so "nothing checked" must block
  // export rather than silently mean "everyone").
  const periodValid =
    dateRange.period !== "custom" || Boolean(dateRange.customFrom && dateRange.customTo);
  const employeesValid = selectedEmployeeIds.length > 0;
  const canExport = periodValid && employeesValid;
  const showContractorField = group === "all-subcontractors";

  // Resolved against the full employee list (not employeeOptions, which is
  // narrowed by the current search text) so the closed-dropdown summary
  // still shows correct names for selections a search happens to be hiding.
  const employeeSummary = useMemo(() => {
    if (selectedEmployeeIds.length === 0) return "בחר עובדים";
    if (selectedEmployeeIds.length <= 2) {
      return selectedEmployeeIds
        .map((id) => employees.find((e) => String(e.id) === String(id))?.name)
        .filter(Boolean)
        .join(", ");
    }
    return `נבחרו ${selectedEmployeeIds.length} עובדים`;
  }, [selectedEmployeeIds, employees]);

  return (
    <div className="card">
      <h3>הגדרת הדוח</h3>

      <div className="form-section">
        <h4 className="form-section-title">פרטי הדוח</h4>
        <div className="filter-grid filter-grid-2">
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
            <label>סוג עובדים</label>
            <div className="employee-actions">
              <button
                type="button"
                className={group === "" ? "primary-btn" : "secondary-btn"}
                onClick={() => handleGroupChange("")}
              >
                כל העובדים
              </button>
              <button
                type="button"
                className={group === "internal" ? "primary-btn" : "secondary-btn"}
                onClick={() => handleGroupChange("internal")}
              >
                העובדים שלי
              </button>
              <button
                type="button"
                className={group === "all-subcontractors" ? "primary-btn" : "secondary-btn"}
                onClick={() => handleGroupChange("all-subcontractors")}
              >
                עובדי קבלן
              </button>
            </div>
          </div>
        </div>

        {showContractorField && (
          <div style={{ marginTop: 14 }}>
            <div className="section-title-row">
              <label>קבלן משנה</label>
              <div className="employee-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() =>
                    setSelectedSubcontractorIds(relevantSubcontractors.map((s) => s.id))
                  }
                >
                  בחר הכל
                </button>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setSelectedSubcontractorIds([])}
                >
                  נקה הכל
                </button>
              </div>
            </div>

            <div className="checkbox-list">
              {relevantSubcontractors.length === 0 ? (
                <div className="empty-message">אין קבלני משנה עם עובדים</div>
              ) : (
                relevantSubcontractors.map((subcontractor) => (
                  <label className="checkbox-item" key={subcontractor.id}>
                    <input
                      type="checkbox"
                      checked={selectedSubcontractorIds.includes(subcontractor.id)}
                      onChange={() => toggleSubcontractor(subcontractor.id)}
                    />
                    <span>
                      {subcontractor.name}
                      {subcontractor.archived ? " (בארכיון)" : ""}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <div className="form-section">
        <h4 className="form-section-title">בחירת עובדים</h4>

        <label>
          עובדים
          <span className="required-mark"> *</span>
        </label>
        <Dropdown label={employeeSummary}>
          <input
            type="text"
            placeholder="🔍 חפש עובד..."
            value={employeeSearch}
            onChange={(e) => setEmployeeSearch(e.target.value)}
          />
          <div className="employee-actions">
            <button
              type="button"
              className="secondary-btn"
              onClick={() =>
                setSelectedEmployeeIds((prev) => [
                  ...new Set([...prev, ...employeeOptions.map((e) => e.id)]),
                ])
              }
            >
              בחר הכל
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => setSelectedEmployeeIds([])}
            >
              נקה הכל
            </button>
          </div>
          <div className="checkbox-list">
            {employeeOptions.length === 0 ? (
              <div className="empty-message">אין עובדים תואמים</div>
            ) : (
              employeeOptions.map((employee) => (
                <label className="checkbox-item" key={employee.id}>
                  <input
                    type="checkbox"
                    checked={selectedEmployeeIds.includes(employee.id)}
                    onChange={() => toggleEmployee(employee.id)}
                  />
                  <span>
                    {employee.name} - {getEmployeeAffiliationName(data, employee)}
                    {isEmployeeArchived(employee, subcontractors) ? " (בארכיון)" : ""}
                  </span>
                </label>
              ))
            )}
          </div>
        </Dropdown>
        {!employeesValid && <p className="field-error">יש לבחור לפחות עובד אחד</p>}

        <p id="employeeCountText">סה״כ עובדים שנבחרו: {selectedEmployeeIds.length}</p>

        <label className="checkbox-item" style={{ display: "inline-flex", marginTop: 8 }}>
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          <span>הצג גם פריטים מהארכיון</span>
        </label>
      </div>

      <hr className="form-divider" />

      <div className="form-section">
        <h4 className="form-section-title">הפקת הדוח</h4>

        <label>סוג הדוח</label>
        <div className="employee-actions">
          <button
            type="button"
            className={reportType === "work" ? "primary-btn" : "secondary-btn"}
            onClick={() => setReportType("work")}
          >
            דוח עבודה לעובדים
          </button>
          <button
            type="button"
            className={reportType === "summary" ? "primary-btn" : "secondary-btn"}
            onClick={() => setReportType("summary")}
          >
            דוח עובדים מסכם
          </button>
        </div>

        <div className="report-actions">
          <button
            className="pdf-btn"
            type="button"
            disabled={!canExport || pdfLoading}
            onClick={reportType === "work" ? handleWorkPDF : handleSummaryPDF}
          >
            <span className="material-symbols-rounded" aria-hidden="true">
              picture_as_pdf
            </span>
            {pdfLoading ? "מכין..." : "ייצוא PDF"}
          </button>
          <button
            className="excel-btn"
            type="button"
            disabled={!canExport}
            onClick={reportType === "work" ? handleWorkExcel : handleSummaryExcel}
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
