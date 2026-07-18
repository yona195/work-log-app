import { useMemo, useState } from "react";
import { useData } from "../state/DataProvider.jsx";
import { getEmployeeAffiliationName } from "../lib/entities.js";
import { filterReportLogs } from "../lib/reports.js";
import { createEmployeeWorkPDF, createEmployeeSummaryPDF } from "../lib/pdf.js";
import { exportEmployeeWorkExcel, exportEmployeeSummaryExcel } from "../lib/excel.js";

const EMPTY_FILTERS = {
  from: "",
  to: "",
  group: "",
  employeeId: "",
};

export default function EmployeeReports() {
  const { data } = useData();
  const { employees } = data;

  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const setFilter = (key, value) =>
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      // Changing the employee type invalidates a specific-employee choice
      // from the previous type.
      if (key === "group") next.employeeId = "";
      return next;
    });

  const employeeOptions = useMemo(() => {
    return employees.filter((employee) => {
      const isInternal = employee.type === "internal";
      const isSub = employee.type === "subcontractor" || employee.type === "external";
      if (filters.group === "internal") return isInternal;
      if (filters.group === "all-subcontractors") return isSub;
      return true;
    });
  }, [employees, filters.group]);

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

  return (
    <>
      <div className="card">
        <h3>סינון דוח</h3>

        <label>מתאריך</label>
        <input
          type="date"
          value={filters.from}
          onChange={(e) => setFilter("from", e.target.value)}
        />

        <label>עד תאריך</label>
        <input
          type="date"
          value={filters.to}
          onChange={(e) => setFilter("to", e.target.value)}
        />

        <label>סוג עובדים</label>
        <select
          value={filters.group}
          onChange={(e) => setFilter("group", e.target.value)}
        >
          <option value="">כל העובדים</option>
          <option value="internal">העובדים שלי</option>
          <option value="all-subcontractors">עובדי קבלן</option>
        </select>

        <label>עובד</label>
        <select
          value={filters.employeeId}
          onChange={(e) => setFilter("employeeId", e.target.value)}
        >
          <option value="">כל העובדים בסוג שנבחר</option>
          {employeeOptions.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name} - {getEmployeeAffiliationName(data, employee)}
            </option>
          ))}
        </select>

        <div className="report-actions">
          <div className="report-action-group">
            <span className="report-action-group-title">דוחות לעובדים</span>
            <div className="report-action-group-buttons">
              <button className="primary-btn" type="button" onClick={handleWorkPDF}>
                הפקת PDF
              </button>
              <button className="secondary-btn" type="button" onClick={handleWorkExcel}>
                ייצוא לאקסל
              </button>
            </div>
          </div>

          <div className="report-action-divider" aria-hidden="true" />

          <div className="report-action-group">
            <span className="report-action-group-title">דוחות עובדים סיכום</span>
            <div className="report-action-group-buttons">
              <button className="primary-btn" type="button" onClick={handleSummaryPDF}>
                הפקת PDF
              </button>
              <button className="secondary-btn" type="button" onClick={handleSummaryExcel}>
                ייצוא לאקסל
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <p>
          <strong>דוחות לעובדים</strong> - טבלה לכל עובד עם התאריכים, אתרי
          העבודה והמבנים שבהם עבד.
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
