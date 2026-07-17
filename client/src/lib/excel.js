import { formatExcelDate, normalizeDate } from "./format.js";
import { getName, getBuildingNames } from "./entities.js";
import { groupLogsByMonth } from "./reports.js";

// Excel sheet names can't contain: \ / ? * [ ] : and are capped at 31 chars.
function toSheetName(label) {
  return label.replace(/[\\/?*[\]:]/g, "-").slice(0, 31);
}

function addMonthWorksheet(workbook, group, data, reportEmployeesFor) {
  const worksheet = workbook.addWorksheet(toSheetName(group.label), {
    views: [{ rightToLeft: true, state: "frozen", ySplit: 4 }],
  });

  worksheet.columns = [
    { key: "date", width: 15 },
    { key: "employees", width: 38 },
    { key: "employeeCount", width: 15 },
    { key: "site", width: 22 },
    { key: "buildings", width: 30 },
    { key: "customer", width: 24 },
    { key: "notes", width: 40 },
  ];

  const monthDates = group.logs
    .map((log) => normalizeDate(log.date))
    .filter(Boolean)
    .sort();
  const fromDate = monthDates[0] || "";
  const toDate = monthDates[monthDates.length - 1] || "";

  worksheet.mergeCells("A1:G1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = `דוח יומן עבודה - ${group.label}`;
  titleCell.font = { bold: true, size: 20 };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(1).height = 34;

  worksheet.mergeCells("A2:G2");
  const datesCell = worksheet.getCell("A2");
  datesCell.value = `תאריכי הדוח: ${formatExcelDate(
    fromDate
  )} עד ${formatExcelDate(toDate)}`;
  datesCell.font = { bold: true, size: 12 };
  datesCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(2).height = 24;

  worksheet.getRow(3).height = 10;

  const headerRow = worksheet.getRow(4);
  headerRow.values = [
    "תאריך",
    "עובדים",
    "סה״כ עובדים",
    "אתר עבודה",
    "מבנים",
    "מזמין עבודה",
    "הערות",
  ];
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF2563EB" },
    };
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
    const thin = { style: "thin", color: { argb: "FFD1D5DB" } };
    cell.border = { top: thin, bottom: thin, left: thin, right: thin };
  });

  group.logs.forEach((log) => {
    const reportEmployees = reportEmployeesFor(log);
    const [year, month, day] = normalizeDate(log.date).split("-").map(Number);
    worksheet.addRow({
      // UTC midnight, not local: ExcelJS serializes dates via UTC math, so a
      // local-midnight Date shifts back a day in timezones ahead of UTC.
      date: new Date(Date.UTC(year, month - 1, day)),
      employees: reportEmployees.map((e) => e.name).join(", "),
      employeeCount: reportEmployees.length,
      site: getName(data.sites, log.siteId),
      buildings: getBuildingNames(data, log),
      customer: getName(data.customers, log.customerId),
      notes: log.notes || "",
    });
  });

  worksheet.getColumn("A").numFmt = "dd-mm-yyyy";

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= 4) return;
    row.height = 25;
    row.eachCell((cell) => {
      cell.alignment = {
        horizontal: "right",
        vertical: "middle",
        wrapText: true,
      };
      const thin = { style: "thin", color: { argb: "FFE5E7EB" } };
      cell.border = { top: thin, bottom: thin, left: thin, right: thin };
      if (rowNumber % 2 === 0) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF3F4F6" },
        };
      }
    });
    row.getCell("A").alignment = { horizontal: "center", vertical: "middle" };
    row.getCell("C").alignment = { horizontal: "center", vertical: "middle" };
  });

  worksheet.autoFilter = { from: "A4", to: "G4" };
  worksheet.pageSetup = {
    orientation: "landscape",
    paperSize: 9,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 0.25,
      right: 0.25,
      top: 0.5,
      bottom: 0.5,
      header: 0.2,
      footer: 0.2,
    },
  };
}

export async function exportToExcel(data, filteredLogs, reportEmployeesFor) {
  if (!filteredLogs || filteredLogs.length === 0) {
    alert("אין נתונים לייצוא");
    return;
  }

  try {
    // Heavy deps — loaded on demand to keep them out of the initial bundle.
    const [{ default: ExcelJS }, { saveAs }] = await Promise.all([
      import("exceljs"),
      import("file-saver"),
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "יומן עבודה";
    workbook.created = new Date();

    const monthGroups = groupLogsByMonth(filteredLogs);
    monthGroups.forEach((group) => {
      addMonthWorksheet(workbook, group, data, reportEmployeesFor);
    });

    const reportDates = filteredLogs
      .map((log) => normalizeDate(log.date))
      .filter(Boolean)
      .sort();
    const fromDate = reportDates[0] || "";
    const toDate = reportDates[reportDates.length - 1] || "";

    const buffer = await workbook.xlsx.writeBuffer();
    const file = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(file, `יומן_עבודה_${fromDate}_עד_${toDate}.xlsx`);
  } catch (error) {
    console.error("שגיאה ביצירת קובץ Excel:", error);
    alert("הפקת קובץ Excel נכשלה.");
  }
}
