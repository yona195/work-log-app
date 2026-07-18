import { getName, getBuildingNames } from "./entities.js";
import {
  groupLogsByMonth,
  calculateEmployerBreakdown,
  calculateEmployeeBreakdown,
} from "./reports.js";
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
        .month-section:not(:first-of-type) { page-break-before: always; }
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

// Builds the employer report's HTML document: one section per month, and
// within each month one table per workforce group (internal employees, then
// each subcontractor) — same row shape as the customer report plus per-row
// cost/payment/profit, with a totals row per table. Pure/no browser APIs —
// shared between the on-screen PDF button and the server-side monthly email.
export function buildEmployerReportHtml(
  data,
  filteredLogs,
  filters,
  { autoPrint = true } = {}
) {
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

  const groupTable = (group) => {
    const rows = group.rows
      .map(
        (row) => `
          <tr>
            <td dir="ltr">${formatDate(row.date)}</td>
            <td>${escapeHtml(row.employeeNames)}</td>
            <td>${row.employeeCount}</td>
            <td>${escapeHtml(row.site)}</td>
            <td>${escapeHtml(row.buildings)}</td>
            <td>${escapeHtml(row.customer)}</td>
            <td>${escapeHtml(row.notes)}</td>
            <td>${escapeHtml(formatCurrency(row.cost))}</td>
            <td>${escapeHtml(formatCurrency(row.revenue))}</td>
            <td>${escapeHtml(formatCurrency(row.profit))}</td>
          </tr>
        `
      )
      .join("");

    return `
      <h3 class="group-title">${escapeHtml(group.name)}</h3>
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
            <th>עלות יומית</th>
            <th>תשלום יומי</th>
            <th>רווח/הפסד יומי</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr class="totals-label-row">
            <td colspan="7"></td>
            <td>עלות חודשית</td>
            <td>תשלום חודשי</td>
            <td>רווח/הפסד חודשי</td>
          </tr>
          <tr class="totals-row">
            <td colspan="7">סה״כ</td>
            <td>${escapeHtml(formatCurrency(group.totalCost))}</td>
            <td>${escapeHtml(formatCurrency(group.totalRevenue))}</td>
            <td>${escapeHtml(formatCurrency(group.totalProfit))}</td>
          </tr>
        </tbody>
      </table>
    `;
  };

  const monthSummary = (groups) => {
    const totals = groups.reduce(
      (acc, group) => ({
        cost: acc.cost + group.totalCost,
        revenue: acc.revenue + group.totalRevenue,
        profit: acc.profit + group.totalProfit,
      }),
      { cost: 0, revenue: 0, profit: 0 }
    );

    return `
      <h3 class="month-summary-title">סיכום כללי</h3>
      <div class="totals-tiles">
        <div class="total-tile">
          <div class="total-label">עלות חודשית</div>
          <div class="total-value">${escapeHtml(formatCurrency(totals.cost))}</div>
        </div>
        <div class="total-tile">
          <div class="total-label">תשלום חודשי</div>
          <div class="total-value">${escapeHtml(formatCurrency(totals.revenue))}</div>
        </div>
        <div class="total-tile">
          <div class="total-label">רווח/הפסד חודשי</div>
          <div class="total-value">${escapeHtml(formatCurrency(totals.profit))}</div>
        </div>
      </div>
    `;
  };

  const monthSections = groupLogsByMonth(filteredLogs)
    .map((month) => {
      const groups = calculateEmployerBreakdown(data, month.logs, filters);
      if (groups.length === 0) return "";

      return `
        <section class="month-section">
          <h2 class="month-title">${escapeHtml(month.label)}</h2>
          ${monthSummary(groups)}
          ${groups.map(groupTable).join("")}
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

  const printScript = autoPrint
    ? `<script>
        window.onload = function () { window.print(); };
      <\/script>`
    : "";

  return `
    <!DOCTYPE html>
    <html lang="he" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>דוח מעסיק</title>
      <style>
        @page { size: A4 landscape; margin: 10mm; }
        body { font-family: Arial, sans-serif; padding: 20px; direction: rtl; color: #222; }
        h1 { text-align: center; margin-bottom: 10px; }
        .summary { text-align: center; margin-bottom: 20px; font-size: 17px; }
        .month-section { margin-top: 20px; }
        .month-section:not(:first-of-type) { page-break-before: always; }
        .month-title { margin-bottom: 8px; }
        .group-title { margin-top: 20px; margin-bottom: 6px; font-size: 15px; }
        .month-summary-title { margin-bottom: 6px; font-size: 14px; color: #444; }
        .totals-tiles { display: flex; gap: 12px; }
        .total-tile { flex: 1; border: 1px solid #999; border-radius: 6px; padding: 10px; text-align: center; background: #f8fafc; }
        .total-label { font-size: 13px; color: #555; }
        .total-value { font-size: 18px; font-weight: bold; margin-top: 4px; color: #1d4ed8; }
        table { width: 100%; border-collapse: collapse; margin-top: 6px; table-layout: auto; }
        th { background: #2563eb; color: white; }
        th, td { border: 1px solid #999; padding: 8px; text-align: center; font-size: 12px; vertical-align: middle; word-break: break-word; }
        tr.totals-label-row td { background: #dbeafe; font-weight: bold; font-size: 11px; color: #1d4ed8; }
        tr.totals-row td { background: #eff6ff; font-weight: bold; }
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
      <h1>דוח מעסיק</h1>
      <div class="summary">
        תאריכי הדוח:
        <span dir="ltr">${fromDate}</span>
        עד
        <span dir="ltr">${toDate}</span>
      </div>
      ${monthSections}
      ${printScript}
    </body>
    </html>
  `;
}

// Opens a print-ready window with the employer's report. Thin browser
// wrapper around buildEmployerReportHtml — see that function for the actual
// layout (shared with the server-side monthly email).
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

  printWindow.document.write(buildEmployerReportHtml(data, filteredLogs, filters));
  printWindow.document.close();
}

// Builds the employee report's HTML: one table per employee (not grouped by
// affiliation), covering the whole selected range in a single continuous
// table (no month split). `includeFinance` adds per-row cost/payment/profit
// columns plus a totals row; without it, it's just where each employee
// worked and when.
export function buildEmployeeReportHtml(
  data,
  filteredLogs,
  filters,
  { includeFinance = false, autoPrint = true } = {}
) {
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

  const employeeTable = (employee) => {
    const rows = employee.rows
      .map(
        (row) => `
          <tr>
            <td dir="ltr">${formatDate(row.date)}</td>
            <td>${escapeHtml(row.site)}</td>
            <td>${escapeHtml(row.buildings)}</td>
            ${
              includeFinance
                ? `
                  <td>${escapeHtml(formatCurrency(row.cost))}</td>
                  <td>${escapeHtml(formatCurrency(row.revenue))}</td>
                  <td>${escapeHtml(formatCurrency(row.profit))}</td>
                `
                : ""
            }
          </tr>
        `
      )
      .join("");

    return `
      <h3 class="group-title">${escapeHtml(employee.name)}</h3>
      <table>
        <thead>
          <tr>
            <th>תאריך</th>
            <th>אתר עבודה</th>
            <th>מבנה</th>
            ${
              includeFinance
                ? `<th>עלות יומית</th><th>תשלום יומי</th><th>רווח/הפסד יומי</th>`
                : ""
            }
          </tr>
        </thead>
        <tbody>
          ${rows}
          ${
            includeFinance
              ? `
                <tr class="totals-label-row">
                  <td colspan="3"></td>
                  <td>עלות כוללת</td>
                  <td>תשלום כולל</td>
                  <td>רווח/הפסד כולל</td>
                </tr>
                <tr class="totals-row">
                  <td colspan="3">סה״כ</td>
                  <td>${escapeHtml(formatCurrency(employee.totalCost))}</td>
                  <td>${escapeHtml(formatCurrency(employee.totalRevenue))}</td>
                  <td>${escapeHtml(formatCurrency(employee.totalProfit))}</td>
                </tr>
              `
              : ""
          }
        </tbody>
      </table>
    `;
  };

  const employees = calculateEmployeeBreakdown(data, filteredLogs, filters);

  const reportDates = filteredLogs
    .map((log) => formatDate(log.date))
    .filter(Boolean)
    .sort();
  const fromDate = reportDates[0] || "";
  const toDate = reportDates[reportDates.length - 1] || "";

  const title = includeFinance ? "דוח עובדים - סיכום" : "דוח עובדים";

  const printScript = autoPrint
    ? `<script>
        window.onload = function () { window.print(); };
      <\/script>`
    : "";

  return `
    <!DOCTYPE html>
    <html lang="he" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <style>
        @page { size: A4 landscape; margin: 10mm; }
        body { font-family: Arial, sans-serif; padding: 20px; direction: rtl; color: #222; }
        h1 { text-align: center; margin-bottom: 10px; }
        .summary { text-align: center; margin-bottom: 20px; font-size: 17px; }
        .group-title { margin-top: 20px; margin-bottom: 6px; font-size: 15px; }
        table { width: 100%; border-collapse: collapse; margin-top: 6px; table-layout: auto; }
        th { background: #2563eb; color: white; }
        th, td { border: 1px solid #999; padding: 8px; text-align: center; font-size: 12px; vertical-align: middle; word-break: break-word; }
        tr.totals-label-row td { background: #dbeafe; font-weight: bold; font-size: 11px; color: #1d4ed8; }
        tr.totals-row td { background: #eff6ff; font-weight: bold; }
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
      <h1>${title}</h1>
      <div class="summary">
        תאריכי הדוח:
        <span dir="ltr">${fromDate}</span>
        עד
        <span dir="ltr">${toDate}</span>
      </div>
      ${employees.map(employeeTable).join("")}
      ${printScript}
    </body>
    </html>
  `;
}

function openEmployeeReportPDF(data, filteredLogs, filters, includeFinance) {
  if (!filteredLogs || filteredLogs.length === 0) {
    alert("אין רשומות להפקת דוח");
    return;
  }

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("הדפדפן חסם את פתיחת ה-PDF. צריך לאשר חלונות קופצים לאתר הזה.");
    return;
  }

  printWindow.document.write(
    buildEmployeeReportHtml(data, filteredLogs, filters, { includeFinance })
  );
  printWindow.document.close();
}

export function createEmployeeWorkPDF(data, filteredLogs, filters) {
  openEmployeeReportPDF(data, filteredLogs, filters, false);
}

export function createEmployeeSummaryPDF(data, filteredLogs, filters) {
  openEmployeeReportPDF(data, filteredLogs, filters, true);
}
