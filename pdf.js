function createWorkLogPDF(filteredLogs) {
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
    return String(dateValue || "").split("T")[0];
  };

  const rows = filteredLogs.map(log => {
    const reportEmployees = getReportEmployees(log);

    const employeeNames = reportEmployees
      .map(employee => employee.name)
      .join(", ");

    const employeeCount = reportEmployees.length;

    const site = getName(appData.sites, log.siteId);
    const buildingNames = getBuildingNames(log);
    const customer = getName(appData.customers, log.customerId);

    return `
      <tr>
        <td dir="ltr">${formatDate(log.date)}</td>
        <td>${employeeNames}</td>
        <td>${employeeCount}</td>
        <td>${site}</td>
        <td>${buildingNames}</td>
        <td>${customer}</td>
        <td>${log.notes || ""}</td>
      </tr>
    `;
  }).join("");

  const reportDates = filteredLogs
    .map(log => formatDate(log.date))
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
        body {
          font-family: Arial, sans-serif;
          padding: 30px;
          direction: rtl;
          color: #222;
        }

        h1 {
          text-align: center;
          margin-bottom: 10px;
        }

        .summary {
          text-align: center;
          margin-bottom: 30px;
          font-size: 18px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
          table-layout: auto;
        }

        th {
          background: #2563eb;
          color: white;
        }

        th,
        td {
          border: 1px solid #999;
          padding: 10px;
          text-align: center;
          font-size: 14px;
          vertical-align: middle;
          word-break: break-word;
        }

        @media print {
          body {
            padding: 10px;
          }

          button {
            display: none;
          }

          table {
            page-break-inside: auto;
          }

          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }

          thead {
            display: table-header-group;
          }
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
          ${rows}
        </tbody>
      </table>

      <script>
        window.onload = function() {
          window.print();
        };
      <\/script>
    </body>
    </html>
  `);

  printWindow.document.close();
}