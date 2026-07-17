import { getName, getBuildingNames } from "./entities.js";
import { groupLogsByMonth, calculateFinancialSummary } from "./reports.js";
import { formatCurrency } from "./format.js";

// Opens a print-ready window with the filtered work-log report (RTL, A4
// landscape). Mirrors the original createWorkLogPDF behaviour.
export function createWorkLogPDF(data, filteredLogs, reportEmployeesFor) {
  if (!filteredLogs || filteredLogs.length === 0) {
    alert("אין רשומות להפקת דוח");
    return;
  }

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("הדפדפן חסם את פתיחת ה-PDF. צריך לאשר חלונות קופצים לאתר הזה.");
    return;
  }

  const formatDate = (dateValue) => {
    if (!dateValue) return "";
    const [year, month, day] = String(dateValue).split("T")[0].split("-");
    return `${day}-${month}-${year}`;
  };

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const monthSections = groupLogsByMonth(filteredLogs)
    .map((group) => {
      const rows = group.logs
        .map((log) => {
          const reportEmployees = reportEmployeesFor(log);
          const employeeNames = reportEmployees.map((e) => e.name).join(", ");
          const employeeCount = reportEmployees.length;
          const site = getName(data.sites, log.siteId);
          const buildingNames = getBuildingNames(data, log);
          const customer = getName(data.customers, log.customerId);

          return `
            <tr>
              <td dir="ltr">${formatDate(log.date)}</td>
              <td>${escapeHtml(employeeNames)}</td>
              <td>${employeeCount}</td>
              <td>${escapeHtml(site)}</td>
              <td>${escapeHtml(buildingNames)}</td>
              <td>${escapeHtml(customer)}</td>
              <td>${escapeHtml(log.notes || "")}</td>
            </tr>
          `;
        })
        .join("");

      return `
        <section class="month-section">
          <h2 class="month-title">${escapeHtml(group.label)}</h2>
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
            <tbody>${rows}</tbody>
          </table>
        </section>
      `;
    })
    .join("");

  const reportDates = filteredLogs
    .map((log) => formatDate(log.date))
    .filter(Boolean)
    .sort();

  const fromDate = reportDates[0] || "";
  const toDate = reportDates[reportDates.length - 1] || "";

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="he" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>דוח יומן עבודה</title>
      <style>
        @page { size: A4 landscape; margin: 10mm; }
        body { font-family: Arial, sans-serif; padding: 20px; direction: rtl; color: #222; }
        h1 { text-align: center; margin-bottom: 10px; }
        .summary { text-align: center; margin-bottom: 20px; font-size: 17px; }
        .month-section { margin-top: 20px; }
        .month-section:not(:first-child) { page-break-before: always; }
        .month-title { margin-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; table-layout: auto; }
        th { background: #2563eb; color: white; }
        th, td { border: 1px solid #999; padding: 8px; text-align: center; font-size: 12px; vertical-align: middle; word-break: break-word; }
        @media print {
          body { padding: 0; }
          button { display: none; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
        }
      </style>
    </head>
    <body>
      <h1>דוח יומן עבודה</h1>
      <div class="summary">
        תאריכי הדוח:
        <span dir="ltr">${fromDate}</span>
        עד
        <span dir="ltr">${toDate}</span>
      </div>
      ${monthSections}
      <script>
        window.onload = function () { window.print(); };
      <\/script>
    </body>
    </html>
  `);

  printWindow.document.close();
}

// Opens a print-ready window with the employer's financial summary (revenue/
// cost/profit broken down by workforce, site and customer), one section per
// month. Mirrors createWorkLogPDF's layout but carries no work-log rows.
export function createFinancialSummaryPDF(data, filteredLogs, filters) {
  if (!filteredLogs || filteredLogs.length === 0) {
    alert("אין רשומות להפקת דוח");
    return;
  }

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("הדפדפן חסם את פתיחת ה-PDF. צריך לאשר חלונות קופצים לאתר הזה.");
    return;
  }

  const formatDate = (dateValue) => {
    if (!dateValue) return "";
    const [year, month, day] = String(dateValue).split("T")[0].split("-");
    return `${day}-${month}-${year}`;
  };

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const breakdownTable = (title, groups) => {
    if (groups.length === 0) return "";
    const rows = groups
      .map(
        (g) => `
          <tr>
            <td>${escapeHtml(g.name)}</td>
            <td>${escapeHtml(formatCurrency(g.revenue))}</td>
            <td>${escapeHtml(formatCurrency(g.cost))}</td>
            <td>${escapeHtml(formatCurrency(g.profit))}</td>
          </tr>
        `
      )
      .join("");

    return `
      <h3 class="breakdown-title">${title}</h3>
      <table>
        <thead>
          <tr>
            <th>שם</th>
            <th>הכנסות</th>
            <th>הוצאות</th>
            <th>רווח / הפסד</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  };

  const monthSections = groupLogsByMonth(filteredLogs)
    .map((group) => {
      const summary = calculateFinancialSummary(data, group.logs, filters);

      return `
        <section class="month-section">
          <h2 class="month-title">${escapeHtml(group.label)}</h2>
          <div class="totals-row">
            <div class="total-tile">
              <div class="total-label">הכנסות</div>
              <div class="total-value">${escapeHtml(formatCurrency(summary.totalRevenue))}</div>
            </div>
            <div class="total-tile">
              <div class="total-label">הוצאות</div>
              <div class="total-value">${escapeHtml(formatCurrency(summary.totalCost))}</div>
            </div>
            <div class="total-tile">
              <div class="total-label">${summary.totalProfit >= 0 ? "רווח" : "הפסד"}</div>
              <div class="total-value">${escapeHtml(formatCurrency(summary.totalProfit))}</div>
            </div>
          </div>
          ${breakdownTable("סיכום לפי כוח אדם", summary.workforce)}
          ${breakdownTable("סיכום לפי אתר עבודה", summary.sites)}
          ${breakdownTable("סיכום לפי מזמין עבודה", summary.customers)}
        </section>
      `;
    })
    .join("");

  const reportDates = filteredLogs
    .map((log) => formatDate(log.date))
    .filter(Boolean)
    .sort();

  const fromDate = reportDates[0] || "";
  const toDate = reportDates[reportDates.length - 1] || "";

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="he" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>דוח מעסיק - סיכום כספי</title>
      <style>
        @page { size: A4 landscape; margin: 10mm; }
        body { font-family: Arial, sans-serif; padding: 20px; direction: rtl; color: #222; }
        h1 { text-align: center; margin-bottom: 10px; }
        .summary { text-align: center; margin-bottom: 20px; font-size: 17px; }
        .month-section { margin-top: 20px; }
        .month-section:not(:first-child) { page-break-before: always; }
        .month-title { margin-bottom: 8px; }
        .breakdown-title { margin-top: 20px; margin-bottom: 6px; font-size: 15px; }
        .totals-row { display: flex; gap: 12px; margin-top: 10px; }
        .total-tile { flex: 1; border: 1px solid #999; border-radius: 6px; padding: 10px; text-align: center; }
        .total-label { font-size: 13px; color: #555; }
        .total-value { font-size: 18px; font-weight: bold; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; margin-top: 6px; table-layout: auto; }
        th { background: #2563eb; color: white; }
        th, td { border: 1px solid #999; padding: 8px; text-align: center; font-size: 12px; vertical-align: middle; word-break: break-word; }
        @media print {
          body { padding: 0; }
          button { display: none; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
        }
      </style>
    </head>
    <body>
      <h1>דוח מעסיק - סיכום כספי</h1>
      <div class="summary">
        תאריכי הדוח:
        <span dir="ltr">${fromDate}</span>
        עד
        <span dir="ltr">${toDate}</span>
      </div>
      ${monthSections}
      <script>
        window.onload = function () { window.print(); };
      <\/script>
    </body>
    </html>
  `);

  printWindow.document.close();
}
