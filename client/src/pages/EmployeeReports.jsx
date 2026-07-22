import { useEffect, useMemo, useState } from "react";
import { useData } from "../state/DataProvider.jsx";
import {
  getEmployeeAffiliationName,
  isEmployeeArchived,
} from "../lib/entities.js";
import { filterReportLogs } from "../lib/reports.js";
import { buildEmployeeReportHtml } from "../lib/pdf.js";
import { exportEmployeeWorkExcel, exportEmployeeSummaryExcel } from "../lib/excel.js";
import { useDateRangeFilter } from "../components/PeriodFilter.jsx";
import DatePicker from "../components/DatePicker.jsx";
import SelectionPanel from "../components/SelectionPanel.jsx";
import { exportPdfDirect, NO_DATA_MESSAGE } from "../lib/pdfExport.js";

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
  const [contractorSearch, setContractorSearch] = useState("");
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
    const text = contractorSearch.trim().toLowerCase();
    return subcontractors.filter(
      (s) =>
        idsWithEmployees.has(String(s.id)) &&
        (showArchived || !s.archived) &&
        (!text || s.name.toLowerCase().includes(text))
    );
  }, [subcontractors, employees, group, showArchived, contractorSearch]);

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

  const exportEmployeePdf = (includeFinance, filenamePrefix) =>
    exportPdfDirect({
      hasData: filteredLogs.length > 0,
      logs: filteredLogs,
      filenamePrefix,
      buildHtml: () =>
        buildEmployeeReportHtml(data, filteredLogs, filters, {
          includeFinance,
          autoPrint: false,
        }),
      onLoadingChange: setPdfLoading,
    });

  const handleWorkPDF = () => exportEmployeePdf(false, "דוח_עובדים");
  const handleSummaryPDF = () => exportEmployeePdf(true, "דוח_עובדים_סיכום");

  // Mandatory fields: a complete period, and at least one employee selected
  // (selection starts empty by design, so "nothing checked" must block
  // export rather than silently mean "everyone").
  const periodValid =
    dateRange.period !== "custom" || Boolean(dateRange.customFrom && dateRange.customTo);
  const employeesValid = selectedEmployeeIds.length > 0;
  const canExport = periodValid && employeesValid;
  const showContractorField = group === "all-subcontractors";

  const employeePanelItems = employeeOptions.map((employee) => ({
    id: employee.id,
    label: `${employee.name} - ${getEmployeeAffiliationName(data, employee)}${
      isEmployeeArchived(employee, subcontractors) ? " (בארכיון)" : ""
    }`,
  }));

  const selectAllEmployees = () =>
    setSelectedEmployeeIds((prev) => [
      ...new Set([...prev, ...employeeOptions.map((e) => e.id)]),
    ]);

  const employeePanel = (
    <SelectionPanel
      title="בחירת עובדים"
      required
      search={employeeSearch}
      onSearchChange={setEmployeeSearch}
      searchPlaceholder="🔍 חפש עובד..."
      items={employeePanelItems}
      selectedIds={selectedEmployeeIds}
      onToggle={toggleEmployee}
      onSelectAll={selectAllEmployees}
      onClearAll={() => setSelectedEmployeeIds([])}
      emptyMessage="אין עובדים תואמים"
    />
  );

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
        <h4 className="form-section-title">בחירת כוח אדם</h4>
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

        {showContractorField ? (
          <div className="filter-grid filter-grid-2" style={{ marginTop: 14 }}>
            <div className="filter-grid-item">
              <SelectionPanel
                title="בחירת קבלן"
                search={contractorSearch}
                onSearchChange={setContractorSearch}
                searchPlaceholder="🔍 חפש קבלן..."
                items={relevantSubcontractors.map((s) => ({
                  id: s.id,
                  label: `${s.name}${s.archived ? " (בארכיון)" : ""}`,
                }))}
                selectedIds={selectedSubcontractorIds}
                onToggle={toggleSubcontractor}
                onSelectAll={() =>
                  setSelectedSubcontractorIds((prev) => [
                    ...new Set([...prev, ...relevantSubcontractors.map((s) => s.id)]),
                  ])
                }
                onClearAll={() => setSelectedSubcontractorIds([])}
                emptyMessage="אין קבלני משנה עם עובדים"
              />
            </div>

            <div className="filter-grid-item">
              {selectedSubcontractorIds.length === 0 ? (
                <>
                  <label>
                    בחירת עובדים
                    <span className="required-mark"> *</span>
                  </label>
                  <div className="empty-message">יש לבחור קבלן תחילה</div>
                </>
              ) : (
                employeePanel
              )}
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 14 }}>{employeePanel}</div>
        )}

        {!employeesValid && <p className="field-error">יש לבחור לפחות עובד אחד</p>}

        <p id="employeeCountText">סה״כ עובדים שנבחרו: {selectedEmployeeIds.length}</p>
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
            {pdfLoading ? "מכין את הקובץ..." : "ייצוא PDF"}
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
