export function formatCurrency(value) {
  const number = Number(value) || 0;
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 2,
  }).format(number);
}

export function formatExcelDate(dateValue) {
  if (!dateValue) return "";
  const [year, month, day] = String(dateValue).split("T")[0].split("-");
  return `${day}-${month}-${year}`;
}

export function normalizeDate(value) {
  return String(value || "").split("T")[0];
}

const HEBREW_MONTHS = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];

/** "2026-07" -> "יולי 2026" */
export function formatMonthLabel(monthKey) {
  const [year, month] = String(monthKey || "").split("-");
  const monthName = HEBREW_MONTHS[Number(month) - 1] || "";
  return `${monthName} ${year}`.trim();
}

export function todayISO() {
  return new Date().toISOString().split("T")[0];
}
