import { useMemo, useState } from "react";
import { Bar } from "react-chartjs-2";
import "../lib/charts.js";
import { useData } from "../state/DataProvider.jsx";
import { formatCurrency } from "../lib/format.js";
import { getCurrentMonthRange } from "../lib/entities.js";
import {
  calculateFinanceByWorkforce,
  calculateFinanceForPeriod,
  calculateProfitBySite,
  getLogsForPeriod,
  getMissingRatesForLogs,
} from "../lib/finance.js";

const SITE_COLORS = [
  "rgba(37, 99, 235, 0.8)",
  "rgba(34, 197, 94, 0.8)",
  "rgba(245, 158, 11, 0.8)",
  "rgba(168, 85, 247, 0.8)",
  "rgba(239, 68, 68, 0.8)",
  "rgba(14, 165, 233, 0.8)",
  "rgba(236, 72, 153, 0.8)",
  "rgba(100, 116, 139, 0.8)",
];

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

  const show = () => {
    const range = computeRange(period, customFrom, customTo);
    if (range.from && range.to && range.from > range.to) {
      alert("תאריך ההתחלה לא יכול להיות מאוחר מתאריך הסיום");
      return;
    }
    setApplied(range);
  };

  const { totals, workforce, sites, missingRates } = useMemo(() => {
    const logs = getLogsForPeriod(data, applied.from, applied.to);
    return {
      totals: calculateFinanceForPeriod(data, applied.from, applied.to),
      workforce: calculateFinanceByWorkforce(data, logs),
      sites: calculateProfitBySite(data, logs),
      missingRates: getMissingRatesForLogs(data, logs),
    };
  }, [data, applied]);

  const currencyTick = (value) => formatCurrency(value);

  return (
    <>
      <div className="card dashboard-filter">
        <h3>תקופת הסקירה</h3>

        <label>בחר תקופה</label>
        <select value={period} onChange={(e) => setPeriod(e.target.value)}>
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
              onChange={(e) => setCustomFrom(e.target.value)}
            />
            <label>עד תאריך</label>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
            />
          </div>
        )}

        <button type="button" className="primary-btn" onClick={show}>
          הצג נתונים
        </button>
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
            <div className="chart-container">
              <Bar
                data={{
                  labels: workforce.map((g) => g.name),
                  datasets: [
                    {
                      label: "הכנסות",
                      data: workforce.map((g) => g.revenue),
                      backgroundColor: "rgba(37, 99, 235, 0.75)",
                    },
                    {
                      label: "הוצאות",
                      data: workforce.map((g) => g.cost),
                      backgroundColor: "rgba(239, 68, 68, 0.75)",
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: "bottom" },
                    tooltip: {
                      callbacks: {
                        label: (ctx) =>
                          `${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`,
                      },
                    },
                  },
                  scales: {
                    y: { beginAtZero: true, ticks: { callback: currencyTick } },
                  },
                }}
              />
            </div>
          )}
        </div>

        <div className="card" style={{ marginTop: 20 }}>
          <h3>רווח לפי אתר עבודה</h3>
          {sites.length === 0 ? (
            <p className="dashboard-empty-text">
              אין נתונים מתאימים בתקופה שנבחרה.
            </p>
          ) : (
            <div className="chart-container">
              <Bar
                data={{
                  labels: sites.map((s) => s.name),
                  datasets: [
                    {
                      label: "רווח",
                      data: sites.map((s) => s.profit),
                      backgroundColor: sites.map((s, index) =>
                        s.profit < 0
                          ? "rgba(239, 68, 68, 0.8)"
                          : SITE_COLORS[index % SITE_COLORS.length]
                      ),
                      borderWidth: 1,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        label: (ctx) => `רווח: ${formatCurrency(ctx.raw)}`,
                      },
                    },
                  },
                  scales: {
                    x: { ticks: { font: { size: 14 } } },
                    y: { beginAtZero: true, ticks: { callback: currencyTick } },
                  },
                }}
              />
            </div>
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
                  <th>תאריך</th>
                </tr>
              </thead>
              <tbody>
                {missingRates.map((item, index) => (
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
      </div>
    </>
  );
}
