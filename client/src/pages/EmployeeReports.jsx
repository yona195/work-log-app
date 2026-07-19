import { useEffect, useMemo, useState } from "react";
import { useData } from "../state/DataProvider.jsx";
import {
  getEmployeeAffiliationName,
  isEmployeeArchived,
} from "../lib/entities.js";
import { formatExcelDate } from "../lib/format.js";
import { filterReportLogs } from "../lib/reports.js";
import { createEmployeeWorkPDF, createEmployeeSummaryPDF } from "../lib/pdf.js";
import { exportEmployeeWorkExcel, exportEmployeeSummaryExcel } from "../lib/excel.js";
import PeriodFilter, { useDateRangeFilter } from "../components/PeriodFilter.jsx";

const toggle = (list, id) =>
  list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

const PERIOD_LABELS = {
  "current-month": "החודש הנוכחי",
  "last-three-months": "שלושה חודשים אחרונים",
};

export default function EmployeeReports() {
  const { data } = useData();
  const { employees, subcontractors } = data;

  const dateRange = useDateRangeFilter();
  const [reportType, setReportType] = useState("work"); // "work" | "summary"
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [group, setGroup] = useState("");
  const [showArchived, setShowArchived] = useState(false);

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
    return employees.filter((employee) => {
      if (!showArchived && isEmployeeArchived(employee, subcontractors)) return false;
      const isInternal = employee.type === "internal";
      const isSub = employee.type === "subcontractor" || employee.type === "external";
      if (group === "internal") return isInternal;
      if (group === "all-subcontractors") {
        return (
          isSub &&
          selectedSubcontractorIds.includes(String(employee.subcontractorId || ""))
        );
      }
      return true;
    });
  }, [employees, subcontractors, group, selectedSubcontractorIds, showArchived]);

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
      alert("אין רשומות מתאימות להפקת דוח");
      return;
    }
    fn(data, filteredLogs, filters);
  };

  const handleWorkPDF = requireLogs(createEmployeeWorkPDF);
  const handleWorkExcel = requireLogs(exportEmployeeWorkExcel);
  const handleSummaryPDF = requireLogs(createEmployeeSummaryPDF);
  const handleSummaryExcel = requireLogs(exportEmployeeSummaryExcel);

  const resetPeriod = () => {
    dateRange.setPeriod("current-month");
    dateRange.setCustomFrom("");
    dateRange.setCustomTo("");
  };

  const clearAllFilters = () => {
    resetPeriod();
    handleGroupChange("");
    setShowArchived(false);
  };

  const periodLabel =
    dateRange.period === "custom"
      ? dateRange.customFrom && dateRange.customTo
        ? `${formatExcelDate(dateRange.customFrom)} - ${formatExcelDate(dateRange.customTo)}`
        : "טווח מותאם"
      : PERIOD_LABELS[dateRange.period] || dateRange.period;

  const chips = useMemo(() => {
    const list = [{ key: "period", label: periodLabel, onRemove: resetPeriod }];

    if (group) {
      list.push({
        key: "group",
        label: `סוג עובדים: ${group === "internal" ? "העובדים שלי" : "עובדי קבלן"}`,
        onRemove: () => handleGroupChange(""),
      });
    }

    if (group === "all-subcontractors") {
      selectedSubcontractorIds.forEach((id) => {
        const name = subcontractors.find((s) => String(s.id) === String(id))?.name;
        list.push({
          key: `subcontractor-${id}`,
          label: `קבלן משנה: ${name || "לא נמצא"}`,
          onRemove: () => toggleSubcontractor(id),
        });
      });
    }

    selectedEmployeeIds.forEach((id) => {
      const name = employees.find((e) => String(e.id) === String(id))?.name;
      list.push({
        key: `employee-${id}`,
        label: `עובד: ${name || "לא נמצא"}`,
        onRemove: () => toggleEmployee(id),
      });
    });

    if (showArchived) {
      list.push({
        key: "archived",
        label: "כולל פריטים בארכיון",
        onRemove: () => setShowArchived(false),
      });
    }

    return list;
  }, [
    periodLabel,
    group,
    selectedSubcontractorIds,
    selectedEmployeeIds,
    subcontractors,
    employees,
    showArchived,
  ]);

  return (
    <>
      <div className="card">
        <h3>סינון דוח</h3>

        <div className="filter-row">
          <div className="filter-row-item">
            <PeriodFilter
              period={dateRange.period}
              onPeriodChange={dateRange.setPeriod}
              customFrom={dateRange.customFrom}
              customTo={dateRange.customTo}
              onCustomFromChange={dateRange.setCustomFrom}
              onCustomToChange={dateRange.setCustomTo}
            />
          </div>

          <div className="filter-row-item">
            <label>סוג דוח</label>
            <div className="employee-actions">
              <button
                type="button"
                className={reportType === "work" ? "primary-btn" : "secondary-btn"}
                onClick={() => setReportType("work")}
              >
                דוחות לעובדים
              </button>
              <button
                type="button"
                className={reportType === "summary" ? "primary-btn" : "secondary-btn"}
                onClick={() => setReportType("summary")}
              >
                דוחות עובדים סיכום
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="secondary-btn advanced-filters-toggle"
          onClick={() => setAdvancedOpen((open) => !open)}
        >
          {advancedOpen ? "הסתר סינון מתקדם ▲" : "סינון מתקדם ▼"}
        </button>

        {advancedOpen && (
          <div className="advanced-filters">
            <label>סוג עובדים</label>
            <select value={group} onChange={(e) => handleGroupChange(e.target.value)}>
              <option value="">כל העובדים</option>
              <option value="internal">העובדים שלי</option>
              <option value="all-subcontractors">עובדי קבלן</option>
            </select>

            {group === "all-subcontractors" && (
              <>
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
              </>
            )}

            <div className="section-title-row">
              <label>בחירת עובדים</label>
              <div className="employee-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setSelectedEmployeeIds(employeeOptions.map((e) => e.id))}
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

            <p id="employeeCountText">
              סה״כ עובדים שנבחרו: {selectedEmployeeIds.length}
            </p>

            <label className="checkbox-item" style={{ display: "inline-flex", marginTop: 8 }}>
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
              <span>הצג פריטים בארכיון ברשימות הסינון</span>
            </label>
          </div>
        )}

        <div className="filter-chips">
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

        <div className="report-actions">
          <button
            className="primary-btn"
            type="button"
            onClick={reportType === "work" ? handleWorkPDF : handleSummaryPDF}
          >
            ייצוא PDF
          </button>
          <button
            className="excel-btn"
            type="button"
            onClick={reportType === "work" ? handleWorkExcel : handleSummaryExcel}
          >
            ייצוא אקסל
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <p>
          <strong>דוחות לעובדים</strong> - טבלה לכל עובד עם התאריכים, אתרי
          העבודה, המבנים שבהם עבד, וסה״כ ימי עבודה.
        </p>
        <p style={{ marginTop: 10 }}>
          <strong>דוחות עובדים סיכום</strong> - אותו דבר, בתוספת עלות, תשלום
          ורווח/הפסד לכל יום ושורת סיכום לכל עובד.
        </p>
        <p style={{ marginTop: 10 }}>סה״כ רשומות בטווח שנבחר: {filteredLogs.length}</p>
      </div>
    </>
  );
}
