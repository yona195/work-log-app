import { formatExcelDate, normalizeDate } from "./format.js";
import { getName, getBuildingNames } from "./entities.js";
import { groupLogsByMonth, calculateFinancialSummary } from "./reports.js";

const CURRENCY_FORMAT = '#,##0.00 "₪"';

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

// Writes a titled breakdown table (name/revenue/cost/profit rows) starting
// at `startRow`. Returns the next free row after the table's spacer.
function addBreakdownSection(worksheet, startRow, title, groups) {
  let row = startRow;

  worksheet.mergeCells(`A${row}:D${row}`);
  const titleCell = worksheet.getCell(`A${row}`);
  titleCell.value = title;
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: "right", vertical: "middle" };
  worksheet.getRow(row).height = 26;
  row += 1;

  const headerRow = worksheet.getRow(row);
  headerRow.values = ["שם", "הכנסות", "הוצאות", "רווח / הפסד"];
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF2563EB" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    const thin = { style: "thin", color: { argb: "FFD1D5DB" } };
    cell.border = { top: thin, bottom: thin, left: thin, right: thin };
  });
  row += 1;

  if (groups.length === 0) {
    worksheet.mergeCells(`A${row}:D${row}`);
    const emptyCell = worksheet.getCell(`A${row}`);
    emptyCell.value = "אין נתונים";
    emptyCell.alignment = { horizontal: "center", vertical: "middle" };
    row += 1;
  } else {
    groups.forEach((group, index) => {
      const dataRow = worksheet.getRow(row);
      dataRow.values = [group.name, group.revenue, group.cost, group.profit];
      dataRow.height = 22;
      dataRow.eachCell((cell, colNumber) => {
        cell.alignment = { horizontal: "right", vertical: "middle" };
        if (colNumber > 1) cell.numFmt = CURRENCY_FORMAT;
        const thin = { style: "thin", color: { argb: "FFE5E7EB" } };
        cell.border = { top: thin, bottom: thin, left: thin, right: thin };
        if (index % 2 === 1) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF3F4F6" },
          };
        }
      });
      row += 1;
    });
  }

  return row + 1; // blank spacer before the next section
}

function addFinancialSummaryWorksheet(workbook, group, data, filters) {
  const worksheet = workbook.addWorksheet(toSheetName(group.label), {
    views: [{ rightToLeft: true }],
  });

  worksheet.columns = [
    { key: "name", width: 30 },
    { key: "revenue", width: 20 },
    { key: "cost", width: 20 },
    { key: "profit", width: 20 },
  ];

  const summary = calculateFinancialSummary(data, group.logs, filters);

  const monthDates = group.logs
    .map((log) => normalizeDate(log.date))
    .filter(Boolean)
    .sort();
  const fromDate = monthDates[0] || "";
  const toDate = monthDates[monthDates.length - 1] || "";

  worksheet.mergeCells("A1:D1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = `דוח מעסיק - ${group.label}`;
  titleCell.font = { bold: true, size: 20 };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(1).height = 34;

  worksheet.mergeCells("A2:D2");
  const datesCell = worksheet.getCell("A2");
  datesCell.value = `תאריכי הדוח: ${formatExcelDate(
    fromDate
  )} עד ${formatExcelDate(toDate)}`;
  datesCell.font = { bold: true, size: 12 };
  datesCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(2).height = 24;

  const totalsHeaderRow = worksheet.getRow(4);
  totalsHeaderRow.values = [
    "",
    "הכנסות",
    "הוצאות",
    summary.totalProfit >= 0 ? "רווח" : "הפסד",
  ];
  totalsHeaderRow.height = 26;
  totalsHeaderRow.eachCell((cell, colNumber) => {
    if (colNumber === 1) return;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF2563EB" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  const totalsValueRow = worksheet.getRow(5);
  totalsValueRow.values = [
    "סה״כ",
    summary.totalRevenue,
    summary.totalCost,
    summary.totalProfit,
  ];
  totalsValueRow.height = 26;
  totalsValueRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true, size: 13 };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    if (colNumber > 1) cell.numFmt = CURRENCY_FORMAT;
  });

  let row = 7;
  row = addBreakdownSection(worksheet, row, "סיכום לפי כוח אדם", summary.workforce);
  row = addBreakdownSection(worksheet, row, "סיכום לפי אתר עבודה", summary.sites);
  addBreakdownSection(worksheet, row, "סיכום לפי מזמין עבודה", summary.customers);

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

export async function exportFinancialSummaryToExcel(data, filteredLogs, filters) {
  if (!filteredLogs || filteredLogs.length === 0) {
    alert("אין נתונים לייצוא");
    return;
  }

  try {
    const [{ default: ExcelJS }, { saveAs }] = await Promise.all([
      import("exceljs"),
      import("file-saver"),
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "יומן עבודה";
    workbook.created = new Date();

    const monthGroups = groupLogsByMonth(filteredLogs);
    monthGroups.forEach((group) => {
      addFinancialSummaryWorksheet(workbook, group, data, filters);
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
    saveAs(file, `דוח_מעסיק_${fromDate}_עד_${toDate}.xlsx`);
  } catch (error) {
    console.error("שגיאה ביצירת קובץ Excel:", error);
    alert("הפקת קובץ Excel נכשלה.");
  }
}
