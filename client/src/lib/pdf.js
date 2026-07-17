import { getName, getBuildingNames } from "./entities.js";
import { groupLogsByMonth } from "./reports.js";

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
