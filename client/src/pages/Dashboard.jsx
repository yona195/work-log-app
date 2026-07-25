import { useMemo, useState } from "react";
import ProfitBarChart from "../components/ProfitBarChart.jsx";
import RevenueCostBarChart from "../components/RevenueCostBarChart.jsx";
import DatePicker from "../components/DatePicker.jsx";
import { useData } from "../state/DataProvider.jsx";
import { formatCurrency, formatExcelDate } from "../lib/format.js";
import { getCurrentMonthRange } from "../lib/entities.js";
import { getMissingRatesForLogs } from "../lib/finance.js";
import { calculateFinancialSummary, filterReportLogs } from "../lib/reports.js";

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function computeRange(period, customFrom, customTo) {
  const now = new Date();

  if (period === "previous-month") {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last = new Date(now.getFullYear(), now.getMonth(), 0);
    return {
      from: formatLocalDate(first),
      to: formatLocalDate(last),
      label: "החודש הקודם",
    };
  }
  if (period === "current-year") {
    const year = now.getFullYear();
    return { from: `${year}-01-01`, to: `${year}-12-31`, label: `שנת ${year}` };
  }
  if (period === "custom") {
    return {
      from: customFrom,
      to: customTo,
      label: customFrom && customTo ? `${customFrom} עד ${customTo}` : "טווח מותאם",
    };
  }
  const month = getCurrentMonthRange();
  return { from: month.from, to: month.to, label: "החודש הנוכחי" };
}

export default function Dashboard() {
  const { data } = useData();
  const month = getCurrentMonthRange();

  const [period, setPeriod] = useState("current-month");
  const [customFrom, setCustomFrom] = useState(month.from);
  const [customTo, setCustomTo] = useState(month.to);
  const [applied, setApplied] = useState(() =>
    computeRange("current-month", month.from, month.to)
  );

  // Applies a range unless it's an incomplete/invalid custom range still
  // being typed — in that case we just keep showing the last valid one.
  const applyRange = (nextPeriod, nextFrom, nextTo) => {
    const range = computeRange(nextPeriod, nextFrom, nextTo);
    if (range.from && range.to && range.from > range.to) return;
    setApplied(range);
  };

  const handlePeriodChange = (value) => {
    setPeriod(value);
    applyRange(value, customFrom, customTo);
  };

  const handleCustomRangeChange = ({ from, to }) => {
    setCustomFrom(from);
    setCustomTo(to);
    applyRange("custom", from, to);
  };

  // Shares the exact calculation reports.js uses for the customer-report
  // financial summary, so the numbers here always match — no second,
  // independently-maintained totals calculation.
  const { totals, workforce, sites, customers } = useMemo(() => {
    const periodFilters = { from: applied.from, to: applied.to };
    const logs = filterReportLogs(data, periodFilters);
    const summary = calculateFinancialSummary(data, logs, periodFilters);
    return {
      totals: {
        revenue: summary.totalRevenue,
        cost: summary.totalCost,
        profit: summary.totalProfit,
      },
      workforce: summary.workforce,
      sites: summary.sites,
      customers: summary.customers,
    };
  }, [data, applied]);

  // Always shown regardless of the selected review period.
  const missingRates = useMemo(
    () => getMissingRatesForLogs(data, data.workLogs),
    [data]
  );

  return (
    <>
      <div>
        <div className="card">
          <div className="card-header-select-row">
            <h3>סיכום כספי</h3>
            <select
              className="card-header-select"
              value={period}
              onChange={(e) => handlePeriodChange(e.target.value)}
            >
              <option value="current-month">החודש הנוכחי</option>
              <option value="previous-month">החודש הקודם</option>
              <option value="current-year">השנה הנוכחית</option>
              <option value="custom">טווח תאריכים</option>
            </select>
          </div>

          {period === "custom" && (
            <div style={{ marginTop: 12 }}>
              <label>טווח תאריכים</label>
              <DatePicker
                mode="range"
                value={{ from: customFrom, to: customTo }}
                onChange={handleCustomRangeChange}
              />
            </div>
          )}

          <div className="cards dashboard-summary-cards" style={{ marginTop: 18 }}>
            <div className="card dashboard-metric-revenue">
              <h3>
                <span className="material-symbols-rounded dashboard-metric-icon" aria-hidden="true">
                  payments
                </span>
                הכנסות
              </h3>
              <p>{formatCurrency(totals.revenue)}</p>
            </div>
            <div className="card dashboard-metric-cost">
              <h3>
                <span className="material-symbols-rounded dashboard-metric-icon" aria-hidden="true">
                  shopping_cart
                </span>
                הוצאות
              </h3>
              <p>{formatCurrency(totals.cost)}</p>
            </div>
            <div
              className={`card ${
                totals.profit >= 0
                  ? "dashboard-metric-profit-positive"
                  : "dashboard-metric-profit-negative"
              }`}
            >
              <h3>
                <span className="material-symbols-rounded dashboard-metric-icon" aria-hidden="true">
                  trending_up
                </span>
                רווח
              </h3>
              <p className={totals.profit >= 0 ? "rates-profit-positive" : "rates-profit-negative"}>
                {formatCurrency(totals.profit)}
              </p>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 20 }}>
          <h3>כוח אדם</h3>

          {workforce.length === 0 ? (
            <p className="dashboard-empty-text">אין נתונים כספיים מתאימים.</p>
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
                {workforce.map((group, index) => (
                  <tr key={`${group.name}-${index}`}>
                    <td>{group.name}</td>
                    <td>{formatCurrency(group.revenue)}</td>
                    <td>{formatCurrency(group.cost)}</td>
                    <td className={group.profit >= 0 ? "rates-profit-positive" : "rates-profit-negative"}>
                      {formatCurrency(group.profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h4 style={{ marginTop: 20 }}>הכנסות מול הוצאות לפי כוח אדם</h4>
          {workforce.length === 0 ? (
            <p className="dashboard-empty-text">
              אין נתונים מתאימים בתקופה שנבחרה.
            </p>
          ) : (
            <RevenueCostBarChart groups={workforce} />
          )}
        </div>

        <div className="card" style={{ marginTop: 20 }}>
          <h3>אתרי עבודה</h3>

          {sites.length === 0 ? (
            <p className="dashboard-empty-text">אין נתונים לפי אתרים.</p>
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
                {sites.map((site, index) => (
                  <tr key={`${site.name}-${index}`}>
                    <td>{site.name}</td>
                    <td>{formatCurrency(site.revenue)}</td>
                    <td>{formatCurrency(site.cost)}</td>
                    <td className={site.profit >= 0 ? "rates-profit-positive" : "rates-profit-negative"}>
                      {formatCurrency(site.profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h4 style={{ marginTop: 20 }}>רווח לפי אתר עבודה</h4>
          {sites.length === 0 ? (
            <p className="dashboard-empty-text">
              אין נתונים מתאימים בתקופה שנבחרה.
            </p>
          ) : (
            <ProfitBarChart groups={sites} label="רווח" />
          )}
        </div>

        <div className="card" style={{ marginTop: 20 }}>
          <h3>מזמיני עבודה</h3>

          {customers.length === 0 ? (
            <p className="dashboard-empty-text">אין נתונים לפי מזמינים.</p>
          ) : (
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
                {customers.map((customer, index) => (
                  <tr key={`${customer.name}-${index}`}>
                    <td>{customer.name}</td>
                    <td>{formatCurrency(customer.revenue)}</td>
                    <td>{formatCurrency(customer.cost)}</td>
                    <td className={customer.profit >= 0 ? "rates-profit-positive" : "rates-profit-negative"}>
                      {formatCurrency(customer.profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h4 style={{ marginTop: 20 }}>רווח לפי מזמין עבודה</h4>
          {customers.length === 0 ? (
            <p className="dashboard-empty-text">
              אין נתונים מתאימים בתקופה שנבחרה.
            </p>
          ) : (
            <ProfitBarChart groups={customers} label="רווח" />
          )}
        </div>

        {missingRates.length > 0 && (
          <div className="card missing-rates-card" style={{ marginTop: 20 }}>
            <h3>⚠️ חסרים תעריפים</h3>
            <p className="missing-rates-intro">
              העובדים הבאים לא נכללו במלואם בחישוב הכספי:
            </p>
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
                {missingRates.map((item, index) => (
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
      </div>
    </>
  );
}
