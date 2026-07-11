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

export function todayISO() {
  return new Date().toISOString().split("T")[0];
}
