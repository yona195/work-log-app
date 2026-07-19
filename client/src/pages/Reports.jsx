import { useMemo, useState } from "react";
import ProfitBarChart from "../components/ProfitBarChart.jsx";
import RevenueCostBarChart from "../components/RevenueCostBarChart.jsx";
import PeriodFilter, { useDateRangeFilter } from "../components/PeriodFilter.jsx";
import { useData } from "../state/DataProvider.jsx";
import { formatCurrency, formatExcelDate } from "../lib/format.js";
import {
  getEmployeeAffiliationName,
  isEmployeeArchived,
  activeOnly,
} from "../lib/entities.js";
import {
  calculateFinancialSummary,
  filterReportLogs,
  getReportEmployees,
} from "../lib/reports.js";
import { createWorkLogPDF, createFinancialSummaryPDF } from "../lib/pdf.js";
import { exportToExcel, exportFinancialSummaryToExcel } from "../lib/excel.js";

const EMPTY_FILTERS = {
  group: "",
  subcontractorId: "",
  employeeId: "",
  siteId: "",
  customerId: "",
};

const PERIOD_LABELS = {
  "current-month": "החודש הנוכחי",
  "last-three-months": "שלושה חודשים אחרונים",
};

export default function Reports() {
  const { data } = useData();
  const { subcontractors, sites, customers, employees } = data;

  const dateRange = useDateRangeFilter();
  const [reportType, setReportType] = useState("customer"); // "customer" | "employer"
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [showArchived, setShowArchived] = useState(false);

  const setFilter = (key, value) =>
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      // Mirror legacy behaviour: internal group clears/locks the subcontractor.
      if (key === "group" && value === "internal") next.subcontractorId = "";
      return next;
    });

  const resetPeriod = () => {
    dateRange.setPeriod("current-month");
    dateRange.setCustomFrom("");
    dateRange.setCustomTo("");
  };

  const clearAllFilters = () => {
    resetPeriod();
    setFilters(EMPTY_FILTERS);
    setShowArchived(false);
  };

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

  const summary = useMemo(
    () => calculateFinancialSummary(data, filteredLogs, effectiveFilters),
    [filteredLogs, data, effectiveFilters]
  );

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

  const periodLabel =
    dateRange.period === "custom"
      ? dateRange.customFrom && dateRange.customTo
        ? `${formatExcelDate(dateRange.customFrom)} - ${formatExcelDate(dateRange.customTo)}`
        : "טווח מותאם"
      : PERIOD_LABELS[dateRange.period] || dateRange.period;

  const chips = useMemo(() => {
    const list = [{ key: "period", label: periodLabel, onRemove: resetPeriod }];

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
      const name = subcontractors.find(
        (s) => String(s.id) === String(filters.subcontractorId)
      )?.name;
      list.push({
        key: "subcontractor",
        label: `קבלן משנה: ${name || "לא נמצא"}`,
        onRemove: () => setFilter("subcontractorId", ""),
      });
    }
    if (filters.employeeId) {
      const name = employees.find(
        (e) => String(e.id) === String(filters.employeeId)
      )?.name;
      list.push({
        key: "employee",
        label: `עובד: ${name || "לא נמצא"}`,
        onRemove: () => setFilter("employeeId", ""),
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
    if (filters.customerId) {
      const name = customers.find(
        (c) => String(c.id) === String(filters.customerId)
      )?.name;
      list.push({
        key: "customer",
        label: `מזמין: ${name || "לא נמצא"}`,
        onRemove: () => setFilter("customerId", ""),
      });
    }
    if (showArchived) {
      list.push({
        key: "archived",
        label: "כולל פריטים בארכיון",
        onRemove: () => setShowArchived(false),
      });
    }
    return list;
  }, [periodLabel, filters, subcontractors, employees, sites, customers, showArchived]);

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
              {visibleSubcontractors.map((s) => (
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
                  {isEmployeeArchived(employee, subcontractors) ? " (בארכיון)" : ""}
                </option>
              ))}
            </select>

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
            onClick={reportType === "customer" ? handlePDF : handleEmployerPDF}
          >
            ייצוא PDF
          </button>
          <button
            className="excel-btn"
            type="button"
            onClick={reportType === "customer" ? handleExcel : handleEmployerExcel}
          >
            ייצוא אקסל
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <FinancialSummary summary={summary} />
      </div>
    </>
  );
}

function FinancialSummary({ summary }) {
  if (
    summary.workforce.length === 0 &&
    summary.sites.length === 0 &&
    summary.customers.length === 0
  ) {
    return (
      <>
        <h2>סיכום כספי</h2>
        <p>אין רשומות מתאימות לסינון שנבחר.</p>
      </>
    );
  }

  const resultTitle = summary.totalProfit >= 0 ? "רווח" : "הפסד";

  return (
    <>
      <h2>סיכום כספי</h2>

      <div className="cards">
        <div className="card">
          <h3>הכנסות</h3>
          <p>{formatCurrency(summary.totalRevenue)}</p>
        </div>
        <div className="card">
          <h3>הוצאות</h3>
          <p>{formatCurrency(summary.totalCost)}</p>
        </div>
        <div className="card">
          <h3>{resultTitle}</h3>
          <p>{formatCurrency(summary.totalProfit)}</p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h3>סיכום לפי כוח אדם</h3>
        {summary.workforce.length === 0 ? (
          <p>אין נתונים כספיים מתאימים.</p>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>עובדים / קבלן</th>
                  <th>הכנסות</th>
                  <th>הוצאות</th>
                  <th>רווח / הפסד</th>
                </tr>
              </thead>
              <tbody>
                {summary.workforce.map((group, index) => (
                  <tr key={`${group.name}-${index}`}>
                    <td>{group.name}</td>
                    <td>{formatCurrency(group.revenue)}</td>
                    <td>{formatCurrency(group.cost)}</td>
                    <td>{formatCurrency(group.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <RevenueCostBarChart groups={summary.workforce} />
          </>
        )}
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h3>סיכום לפי אתר עבודה</h3>
        {summary.sites.length === 0 ? (
          <p>אין נתונים לפי אתרים.</p>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>אתר</th>
                  <th>הכנסות</th>
                  <th>הוצאות</th>
                  <th>רווח / הפסד</th>
                </tr>
              </thead>
              <tbody>
                {summary.sites.map((site, index) => (
                  <tr key={`${site.name}-${index}`}>
                    <td>{site.name}</td>
                    <td>{formatCurrency(site.revenue)}</td>
                    <td>{formatCurrency(site.cost)}</td>
                    <td>{formatCurrency(site.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ProfitBarChart groups={summary.sites} label="רווח / הפסד" />
          </>
        )}
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h3>סיכום לפי מזמין עבודה</h3>
        {summary.customers.length === 0 ? (
          <p>אין נתונים לפי מזמינים.</p>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>מזמין</th>
                  <th>הכנסות</th>
                  <th>הוצאות</th>
                  <th>רווח / הפסד</th>
                </tr>
              </thead>
              <tbody>
                {summary.customers.map((customer, index) => (
                  <tr key={`${customer.name}-${index}`}>
                    <td>{customer.name}</td>
                    <td>{formatCurrency(customer.revenue)}</td>
                    <td>{formatCurrency(customer.cost)}</td>
                    <td>{formatCurrency(customer.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ProfitBarChart groups={summary.customers} label="רווח / הפסד" />
          </>
        )}
      </div>

      {summary.missingRates.length > 0 && (
        <div className="card missing-rates-card" style={{ marginTop: 20 }}>
          <h3>⚠️ חסרים תעריפים</h3>
          <p>העובדים הבאים לא נכללו במלואם בסיכום:</p>
          <table>
            <thead>
              <tr>
                <th>עובד</th>
                <th>שיוך / קבלן</th>
                <th>אתר</th>
                <th>מזמין</th>
                <th>תאריכים חסרים</th>
              </tr>
            </thead>
            <tbody>
              {summary.missingRates.map((item, index) => (
                <tr key={`${item.employeeName}-${item.siteName}-${item.customerName}-${index}`}>
                  <td>{item.employeeName}</td>
                  <td>{item.affiliationName}</td>
                  <td>{item.siteName}</td>
                  <td>{item.customerName}</td>
                  <td dir="ltr">
                    {item.dates.map(formatExcelDate).join(", ")} ({item.dates.length})
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
