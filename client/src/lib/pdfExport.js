import { api } from "../api.js";
import { normalizeDate } from "./format.js";

export const NO_DATA_MESSAGE = "לא נמצאו נתונים עבור התקופה והבחירות שנבחרו.";

// Mirrors the date-range suffix Excel exports already use (actual log
// dates, not the filter's period bounds), so a PDF and Excel export of the
// same report land on matching filenames.
function dateRangeSuffix(logs) {
  const dates = logs.map((log) => normalizeDate(log.date)).filter(Boolean).sort();
  const from = dates[0] || "";
  const to = dates[dates.length - 1] || "";
  return `${from}_עד_${to}`;
}

/**
 * PDF export flow shared by every report type on both report pages: builds
 * the report HTML, renders it to a real PDF via the existing
 * /api/pdf/render endpoint, and downloads it directly (same pattern as the
 * Excel exports) — no preview tab, no print dialog. `onLoadingChange` lets
 * the caller show a loading state on the button while this is in flight and
 * always restores it afterward, on both success and failure.
 */
export async function exportPdfDirect({ hasData, logs, filenamePrefix, buildHtml, onLoadingChange }) {
  if (!hasData) {
    alert(NO_DATA_MESSAGE);
    return;
  }

  onLoadingChange?.(true);
  try {
    const html = buildHtml();
    const blob = await api.renderPdf(html);
    const { saveAs } = await import("file-saver");
    saveAs(blob, `${filenamePrefix}_${dateRangeSuffix(logs)}.pdf`);
  } catch (error) {
    console.error("PDF export failed:", error);
    alert("אירעה שגיאה בהפקת ה-PDF. נסה שוב.");
  } finally {
    onLoadingChange?.(false);
  }
}
