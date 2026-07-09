function createWorkLogPDF(filteredLogs) {
  if (!filteredLogs || filteredLogs.length === 0) {
    alert("אין רשומות להפקת דוח");
    return;
  }

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
  alert("הדפדפן חסם את פתיחת ה-PDF. צריך לאשר Popups לאתר הזה.");
  return;
}
  const rows = filteredLogs.map(log => {
    const employee = appData.employees.find(e => e.id === log.employeeId);
    const site = appData.sites.find(s => s.id === log.siteId);
    const building = appData.buildings.find(b => b.id === log.buildingId);
    const customer = appData.customers.find(c => c.id === log.customerId);

    return `
      <tr>
        <td>${log.date}</td>
        <td>${employee ? employee.name : ""}</td>
        <td>${site ? site.name : ""}</td>
        <td>${building ? building.name : ""}</td>
        <td>${customer ? customer.name : ""}</td>
        <td>${log.notes || ""}</td>
      </tr>
    `;
  }).join("");

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
        }

        th {
          background: #2563eb;
          color: white;
        }

        th, td {
          border: 1px solid #999;
          padding: 10px;
          text-align: center;
          font-size: 14px;
        }

        @media print {
          button {
            display: none;
          }
        }
      </style>
    </head>
    <body>
      <h1>דוח יומן עבודה</h1>
      <div class="summary">
      תאריכי הדוח:
      ${filteredLogs[filteredLogs.length - 1].date}
      עד
      ${filteredLogs[0].date}
      </div>

      <table>
        <thead>
          <tr>
            <th>תאריך</th>
            <th>עובד</th>
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