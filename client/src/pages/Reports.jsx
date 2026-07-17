import { useMemo, useState } from "react";
import { Bar } from "react-chartjs-2";
import {
  CATEGORICAL_COLORS,
  COST_COLOR,
  NEGATIVE_COLOR,
  REVENUE_COLOR,
  buildBarChartOptions,
} from "../lib/charts.js";
import { useData } from "../state/DataProvider.jsx";
import { formatCurrency, normalizeDate } from "../lib/format.js";
import { getName, getBuildingNames, getEmployeeAffiliationName } from "../lib/entities.js";
import {
  calculateFinancialSummary,
  filterReportLogs,
  getReportEmployees,
  groupLogsByMonth,
} from "../lib/reports.js";
import { createWorkLogPDF, createFinancialSummaryPDF } from "../lib/pdf.js";
import { exportToExcel, exportFinancialSummaryToExcel } from "../lib/excel.js";

const EMPTY_FILTERS = {
  from: "",
  to: "",
  group: "",
  subcontractorId: "",
  employeeId: "",
  siteId: "",
  customerId: "",
};

export default function Reports() {
  const { data } = useData();
  const { subcontractors, sites, customers, employees } = data;

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [view, setView] = useState("none"); // none | report | summary

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

  const filteredLogs = useMemo(
    () => filterReportLogs(data, filters),
    [data, filters]
  );

  const reportEmployeesFor = (log) => getReportEmployees(data, log, filters);

  const monthGroups = useMemo(
    () => groupLogsByMonth(filteredLogs),
    [filteredLogs]
  );

  const summary = useMemo(() => {
    if (view !== "summary") return null;
    return calculateFinancialSummary(data, filteredLogs, filters);
  }, [view, filteredLogs, data, filters]);

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
    createFinancialSummaryPDF(data, filteredLogs, filters);
  };

  const handleEmployerExcel = () =>
    exportFinancialSummaryToExcel(data, filteredLogs, filters);

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
            </option>
          ))}
        </select>

        <div className="report-actions">
          <div className="report-action-group">
            <span className="report-action-group-title">אזור מזמין</span>
            <div className="report-action-group-buttons">
              <button className="primary-btn" type="button" onClick={() => setView("report")}>
                הצג דוח
              </button>
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
              <button className="primary-btn" type="button" onClick={() => setView("summary")}>
                סיכום כספי
              </button>
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
        {view === "none" && <p>בחר סינון ולחץ הצג דוח.</p>}

        {view === "report" && (
          <>
            <h2>דוח יומן עבודה</h2>
            <p>סה״כ רשומות: {filteredLogs.length}</p>
            {filteredLogs.length === 0 ? (
              <p>אין רשומות מתאימות.</p>
            ) : (
              monthGroups.map((group) => (
                <div key={group.key} style={{ marginTop: 20 }}>
                  <h3>{group.label}</h3>
                  <table>
                    <thead>
                      <tr>
                        <th>תאריך</th>
                        <th>עובדים</th>
                        <th>סה״כ עובדים</th>
                        <th>אתר</th>
                        <th>מבנה</th>
                        <th>מזמין</th>
                        <th>הערות</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.logs.map((log) => {
                        const reportEmployees = reportEmployeesFor(log);
                        return (
                          <tr key={log.id}>
                            <td>{normalizeDate(log.date)}</td>
                            <td>{reportEmployees.map((e) => e.name).join(", ")}</td>
                            <td>{reportEmployees.length}</td>
                            <td>{getName(sites, log.siteId)}</td>
                            <td>{getBuildingNames(data, log)}</td>
                            <td>{getName(customers, log.customerId)}</td>
                            <td>{log.notes || ""}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))
            )}
          </>
        )}

        {view === "summary" && summary && (
          <FinancialSummary summary={summary} />
        )}
      </div>
    </>
  );
}

const currencyTick = (value) => formatCurrency(value);

function RevenueCostChart({ groups }) {
  return (
    <div className="chart-container">
      <Bar
        data={{
          labels: groups.map((g) => g.name),
          datasets: [
            {
              label: "הכנסות",
              data: groups.map((g) => g.revenue),
              backgroundColor: REVENUE_COLOR,
              borderRadius: 4,
              maxBarThickness: 64,
            },
            {
              label: "הוצאות",
              data: groups.map((g) => g.cost),
              backgroundColor: COST_COLOR,
              borderRadius: 4,
              maxBarThickness: 64,
            },
          ],
        }}
        options={buildBarChartOptions({
          legend: true,
          grouped: true,
          tooltipLabel: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`,
          yTickFormatter: currencyTick,
        })}
      />
    </div>
  );
}

function ProfitChart({ groups }) {
  return (
    <div className="chart-container">
      <Bar
        data={{
          labels: groups.map((g) => g.name),
          datasets: [
            {
              label: "רווח / הפסד",
              data: groups.map((g) => g.profit),
              backgroundColor: groups.map((g, index) =>
                g.profit < 0
                  ? NEGATIVE_COLOR
                  : CATEGORICAL_COLORS[index % CATEGORICAL_COLORS.length]
              ),
              borderRadius: 4,
              maxBarThickness: 64,
            },
          ],
        }}
        options={buildBarChartOptions({
          tooltipLabel: (ctx) => `רווח / הפסד: ${formatCurrency(ctx.raw)}`,
          yTickFormatter: currencyTick,
        })}
      />
    </div>
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
            <RevenueCostChart groups={summary.workforce} />
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
            <ProfitChart groups={summary.sites} />
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
            <ProfitChart groups={summary.customers} />
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
