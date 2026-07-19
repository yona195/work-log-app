export const HEBREW_MONTHS = [
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

// Sunday-first, matching the app's work week.
export const HEBREW_WEEKDAYS_SHORT = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

function pad(n) {
  return String(n).padStart(2, "0");
}

export function toISO(year, month, day) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

export function todayISO() {
  const now = new Date();
  return toISO(now.getFullYear(), now.getMonth(), now.getDate());
}

export function parseISO(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return { year: y, month: m - 1, day: d };
}

export function addMonths(year, month, delta) {
  const total = month + delta;
  const y = year + Math.floor(total / 12);
  const m = ((total % 12) + 12) % 12;
  return { year: y, month: m };
}

// Weeks (arrays of 7 cells) covering the given month, padded with the
// trailing/leading days of the neighbouring months so every week is full.
export function buildMonthWeeks(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = firstOfMonth.getDay(); // 0 = Sunday

  const cells = [];
  const prevMonthDays = new Date(year, month, 0).getDate();
  for (let i = leadingBlanks - 1; i >= 0; i -= 1) {
    const day = prevMonthDays - i;
    const { year: y, month: m } = addMonths(year, month, -1);
    cells.push({ iso: toISO(y, m, day), day, inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ iso: toISO(year, month, day), day, inMonth: true });
  }
  let nextDay = 1;
  const { year: ny, month: nm } = addMonths(year, month, 1);
  while (cells.length % 7 !== 0) {
    cells.push({ iso: toISO(ny, nm, nextDay), day: nextDay, inMonth: false });
    nextDay += 1;
  }

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}
