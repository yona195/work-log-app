import ExcelJS from "exceljs";
import puppeteer from "puppeteer";
import { Resend } from "resend";

import { getData } from "../db.js";
import { normalizeDate, formatMonthLabel } from "../../../client/src/lib/format.js";
import {
  groupLogsByMonth,
  calculateEmployerBreakdown,
} from "../../../client/src/lib/reports.js";
import { buildEmployerReportHtml } from "../../../client/src/lib/pdf.js";
import { addEmployerWorksheet } from "../../../client/src/lib/excel.js";

/** The calendar month immediately before `referenceDate`, as "YYYY-MM-DD" bounds. */
export function getPreviousMonthRange(referenceDate = new Date()) {
  const prevMonthStart = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth() - 1,
    1
  );
  const year = prevMonthStart.getFullYear();
  const month = prevMonthStart.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const pad = (n) => String(n).padStart(2, "0");

  return {
    from: `${year}-${pad(month + 1)}-01`,
    to: `${year}-${pad(month + 1)}-${pad(lastDay)}`,
  };
}

async function buildPdfBuffer(html) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    return await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
    });
  } finally {
    await browser.close();
  }
}

async function buildExcelBuffer(data, logs) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "יומן עבודה";
  workbook.created = new Date();

  groupLogsByMonth(logs).forEach((month) => {
    const groups = calculateEmployerBreakdown(data, month.logs, {});
    if (groups.length > 0) addEmployerWorksheet(workbook, month, groups);
  });

  return workbook.xlsx.writeBuffer();
}

/**
 * Builds and emails the employer report (PDF + Excel) for the month before
 * `referenceDate`, using the same calculation/layout code as the manual
 * "דוח מעסיק" / "אקסל מעסיק" buttons on the Reports page. Returns a status
 * object rather than throwing when there's simply nothing to report.
 */
export async function sendMonthlyEmployerReport(referenceDate = new Date()) {
  const { from, to } = getPreviousMonthRange(referenceDate);
  const monthKey = from.slice(0, 7);
  const monthLabel = formatMonthLabel(monthKey);

  const data = await getData();
  const logs = data.workLogs.filter((log) => {
    const date = normalizeDate(log.date);
    return date >= from && date <= to;
  });

  if (logs.length === 0) {
    return { sent: false, reason: "no-logs", monthLabel };
  }

  const html = buildEmployerReportHtml(data, logs, {}, { autoPrint: false });
  const [pdfBuffer, excelBuffer] = await Promise.all([
    buildPdfBuffer(html),
    buildExcelBuffer(data, logs),
  ]);

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data: sendResult, error } = await resend.emails.send({
    from: process.env.REPORT_EMAIL_FROM || "onboarding@resend.dev",
    to: process.env.REPORT_EMAIL_TO,
    subject: `דוח מעסיק חודשי - ${monthLabel}`,
    html: `<div dir="rtl" style="font-family: Arial, sans-serif;">מצורף הדוח החודשי (PDF ואקסל) עבור ${monthLabel}.</div>`,
    attachments: [
      { filename: `דוח_מעסיק_${monthKey}.pdf`, content: Buffer.from(pdfBuffer) },
      { filename: `דוח_מעסיק_${monthKey}.xlsx`, content: Buffer.from(excelBuffer) },
    ],
  });

  if (error) {
    throw new Error(`Resend error: ${error.message || JSON.stringify(error)}`);
  }

  return { sent: true, monthLabel, emailId: sendResult?.id };
}
