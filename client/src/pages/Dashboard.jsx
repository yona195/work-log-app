import { useMemo, useState } from "react";
import ProfitBarChart from "../components/ProfitBarChart.jsx";
import RevenueCostBarChart from "../components/RevenueCostBarChart.jsx";
import { useData } from "../state/DataProvider.jsx";
import { formatCurrency } from "../lib/format.js";
import { getCurrentMonthRange } from "../lib/entities.js";
import {
  calculateFinanceByWorkforce,
  calculateFinanceForPeriod,
  calculateProfitByCustomer,
  calculateProfitBySite,
  getLogsForPeriod,
  getMissingRatesForLogs,
} from "../lib/finance.js";

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

  const handleCustomFromChange = (value) => {
    setCustomFrom(value);
    applyRange("custom", value, customTo);
  };

  const handleCustomToChange = (value) => {
    setCustomTo(value);
    applyRange("custom", customFrom, value);
  };

  const { totals, workforce, sites, customers } = useMemo(() => {
    const logs = getLogsForPeriod(data, applied.from, applied.to);
    return {
      totals: calculateFinanceForPeriod(data, applied.from, applied.to),
      workforce: calculateFinanceByWorkforce(data, logs),
      sites: calculateProfitBySite(data, logs),
      customers: calculateProfitByCustomer(data, logs),
    };
  }, [data, applied]);

  // Always shown regardless of the selected review period.
  const missingRates = useMemo(
    () => getMissingRatesForLogs(data, data.workLogs),
    [data]
  );

  return (
    <>
      <div className="card dashboard-filter">
        <h3>תקופת הסקירה</h3>

        <label>בחר תקופה</label>
        <select value={period} onChange={(e) => handlePeriodChange(e.target.value)}>
          <option value="current-month">החודש הנוכחי</option>
          <option value="previous-month">החודש הקודם</option>
          <option value="current-year">השנה הנוכחית</option>
          <option value="custom">טווח תאריכים</option>
        </select>

        {period === "custom" && (
          <div>
            <label>מתאריך</label>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => handleCustomFromChange(e.target.value)}
            />
            <label>עד תאריך</label>
            <input
              type="date"
              value={customTo}
              onChange={(e) => handleCustomToChange(e.target.value)}
            />
          </div>
        )}
      </div>

      <div style={{ marginTop: 20 }}>
        <div className="card">
          <h3>סיכום כספי - {applied.label}</h3>
          <div className="cards">
            <div className="card">
              <h3>הכנסות</h3>
              <p>{formatCurrency(totals.revenue)}</p>
            </div>
            <div className="card">
              <h3>הוצאות</h3>
              <p>{formatCurrency(totals.cost)}</p>
            </div>
            <div className="card">
              <h3>רווח</h3>
              <p>{formatCurrency(totals.profit)}</p>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 20 }}>
          <h3>הכנסות מול הוצאות לפי כוח אדם</h3>
          {workforce.length === 0 ? (
            <p className="dashboard-empty-text">
              אין נתונים מתאימים בתקופה שנבחרה.
            </p>
          ) : (
            <RevenueCostBarChart groups={workforce} />
          )}
        </div>

        <div className="card" style={{ marginTop: 20 }}>
          <h3>רווח לפי אתר עבודה</h3>
          {sites.length === 0 ? (
            <p className="dashboard-empty-text">
              אין נתונים מתאימים בתקופה שנבחרה.
            </p>
          ) : (
            <ProfitBarChart groups={sites} label="רווח" />
          )}
        </div>

        <div className="card" style={{ marginTop: 20 }}>
          <h3>רווח לפי מזמין עבודה</h3>
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
                      {item.dates.join(", ")} ({item.dates.length})
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
