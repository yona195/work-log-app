import { useMemo, useState } from "react";
import { useData } from "../state/DataProvider.jsx";
import { formatCurrency, normalizeDate } from "../lib/format.js";
import { getName, getBuildingNames, getEmployeeAffiliationName } from "../lib/entities.js";
import {
  calculateFilteredWorkLogFinance,
  filterReportLogs,
  getReportEmployees,
} from "../lib/reports.js";
import { createWorkLogPDF } from "../lib/pdf.js";
import { exportToExcel } from "../lib/excel.js";

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

  const summary = useMemo(() => {
    if (view !== "summary") return null;

    let totalRevenue = 0;
    let totalCost = 0;
    let totalProfit = 0;
    const workforceGroups = {};
    const siteGroups = {};
    const missingRates = [];

    filteredLogs.forEach((log) => {
      const finance = calculateFilteredWorkLogFinance(data, log, filters);
      totalRevenue += finance.revenue;
      totalCost += finance.cost;
      totalProfit += finance.profit;

      const siteId = String(log.siteId || "");
      const siteName = getName(sites, log.siteId) || "אתר לא ידוע";
      if (!siteGroups[siteId]) {
        siteGroups[siteId] = { name: siteName, revenue: 0, cost: 0, profit: 0 };
      }
      siteGroups[siteId].revenue += finance.revenue;
      siteGroups[siteId].cost += finance.cost;
      siteGroups[siteId].profit += finance.profit;

      finance.calculatedEmployees.forEach((calc) => {
        const employee = employees.find(
          (e) => String(e.id) === String(calc.employeeId)
        );
        if (!employee) return;
        let groupKey;
        let groupName;
        if (employee.type === "internal") {
          groupKey = "internal";
          groupName = "העובדים שלי";
        } else {
          groupKey = `subcontractor-${employee.subcontractorId}`;
          groupName =
            getName(subcontractors, employee.subcontractorId) || "קבלן לא ידוע";
        }
        if (!workforceGroups[groupKey]) {
          workforceGroups[groupKey] = {
            name: groupName,
            revenue: 0,
            cost: 0,
            profit: 0,
          };
        }
        workforceGroups[groupKey].revenue += calc.revenue;
        workforceGroups[groupKey].cost += calc.cost;
        workforceGroups[groupKey].profit += calc.profit;
      });

      finance.missingRateEmployees.forEach((missing) => {
        const employee = employees.find(
          (e) => String(e.id) === String(missing.employeeId)
        );
        missingRates.push({
          employeeName: missing.employeeName,
          affiliationName: employee
            ? getEmployeeAffiliationName(data, employee)
            : "שיוך לא ידוע",
          siteName,
          date: normalizeDate(log.date),
        });
      });
    });

    return {
      totalRevenue,
      totalCost,
      totalProfit,
      workforce: Object.values(workforceGroups),
      sites: Object.values(siteGroups),
      missingRates,
    };
  }, [view, filteredLogs, data, filters, sites, subcontractors, employees]);

  const handlePDF = () => {
    if (filteredLogs.length === 0) {
      alert("אין רשומות מתאימות להפקת PDF");
      return;
    }
    createWorkLogPDF(data, filteredLogs, reportEmployeesFor);
  };

  const handleExcel = () => exportToExcel(data, filteredLogs, reportEmployeesFor);

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

        <div
          style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}
        >
          <button className="primary-btn" type="button" onClick={() => setView("report")}>
            הצג דוח
          </button>
          <button className="primary-btn" type="button" onClick={() => setView("summary")}>
            סיכום כספי
          </button>
          <button className="primary-btn" type="button" onClick={handlePDF}>
            הפק PDF
          </button>
          <button className="primary-btn" type="button" onClick={handleExcel}>
            ייצוא לאקסל
          </button>
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
                  {filteredLogs.map((log) => {
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

function FinancialSummary({ summary }) {
  if (summary.workforce.length === 0 && summary.sites.length === 0) {
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
        )}
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h3>סיכום לפי אתר עבודה</h3>
        {summary.sites.length === 0 ? (
          <p>אין נתונים לפי אתרים.</p>
        ) : (
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
                <th>תאריך</th>
              </tr>
            </thead>
            <tbody>
              {summary.missingRates.map((item, index) => (
                <tr key={`${item.employeeName}-${item.date}-${index}`}>
                  <td>{item.employeeName}</td>
                  <td>{item.affiliationName}</td>
                  <td>{item.siteName}</td>
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
