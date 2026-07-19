import { useMemo, useState } from "react";
import ProfitBarChart from "../components/ProfitBarChart.jsx";
import RevenueCostBarChart from "../components/RevenueCostBarChart.jsx";
import PeriodFilter, { useDateRangeFilter } from "../components/PeriodFilter.jsx";
import { useData } from "../state/DataProvider.jsx";
import { formatCurrency } from "../lib/format.js";
import { getEmployeeAffiliationName } from "../lib/entities.js";
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

export default function Reports() {
  const { data } = useData();
  const { subcontractors, sites, customers, employees } = data;

  const dateRange = useDateRangeFilter();
  const [filters, setFilters] = useState(EMPTY_FILTERS);

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

  return (
    <>
      <div className="card">
        <h3>סינון דוח</h3>

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

        <div className="report-actions">
          <div className="report-action-group">
            <span className="report-action-group-title">אזור מזמין</span>
            <div className="report-action-group-buttons">
              <button className="secondary-btn" type="button" onClick={handlePDF}>
                דוח מזמין
              </button>
              <button className="secondary-btn" type="button" onClick={handleExcel}>
                אקסל מזמין
              </button>
            </div>
          </div>

          <div className="report-action-divider" aria-hidden="true" />

          <div className="report-action-group">
            <span className="report-action-group-title">אזור מעסיק</span>
            <div className="report-action-group-buttons">
              <button className="secondary-btn" type="button" onClick={handleEmployerPDF}>
                דוח מעסיק
              </button>
              <button className="secondary-btn" type="button" onClick={handleEmployerExcel}>
                אקסל מעסיק
              </button>
            </div>
          </div>
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
                <th>תאריך</th>
              </tr>
            </thead>
            <tbody>
              {summary.missingRates.map((item, index) => (
                <tr key={`${item.employeeName}-${item.date}-${index}`}>
                  <td>{item.employeeName}</td>
                  <td>{item.affiliationName}</td>
                  <td>{item.siteName}</td>
                  <td>{item.customerName}</td>
                  <td dir="ltr">{item.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
