import { normalizeDate } from "./format.js";

export function getName(list, id) {
  const item = (list || []).find((x) => String(x.id) === String(id));
  return item ? item.name : "";
}

// Excludes archived records — used for "pick for a new record" pickers
// (adding a work log, creating a new rate, etc). Report filters and
// settings-page listings intentionally keep archived records visible.
export function activeOnly(list) {
  return (list || []).filter((item) => !item.archived);
}

// An employee counts as archived not only when flagged directly, but also
// when their own subcontractor was archived — archiving a subcontractor
// must ripple down: you shouldn't be able to pick a defunct subcontractor's
// employee for a fresh work log or rate. The employee's own `archived` flag
// is left untouched, so restoring the subcontractor makes their employees
// pickable again without any extra step.
export function isEmployeeArchived(employee, subcontractors) {
  if (!employee) return false;
  if (employee.archived) return true;
  if (employee.type === "internal") return false;
  const subcontractor = (subcontractors || []).find(
    (s) => String(s.id) === String(employee.subcontractorId)
  );
  return Boolean(subcontractor && subcontractor.archived);
}

// Excludes employees archived per isEmployeeArchived() — used for "pick for
// a new record" pickers (adding a work log, creating a new rate).
export function activeEmployees(data) {
  return (data.employees || []).filter(
    (employee) => !isEmployeeArchived(employee, data.subcontractors)
  );
}

// work logs from the API carry arrays; still tolerate legacy string forms.
function toIdArray(value, fallbackSingle) {
  if (Array.isArray(value)) {
    return value.map((id) => String(id).trim()).filter(Boolean);
  }
  if (value === undefined || value === null || value === "") {
    return fallbackSingle ? [String(fallbackSingle)] : [];
  }
  const raw = String(value).trim();
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((id) => String(id).trim()).filter(Boolean);
    }
  } catch {
    // fall through to comma parsing
  }
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export function getEmployeeIds(log) {
  return toIdArray(log.employeeIds, log.employeeId);
}

export function getBuildingIds(log) {
  return toIdArray(log.buildingIds, log.buildingId);
}

export function getEmployeeNames(data, log) {
  return getEmployeeIds(log)
    .map((id) => getName(data.employees, id))
    .filter(Boolean)
    .join(", ");
}

export function getBuildingNames(data, log) {
  return getBuildingIds(log)
    .map((id) => getName(data.buildings, id))
    .filter(Boolean)
    .join(", ");
}

export function getEmployeeAffiliationName(data, employee) {
  if (employee.type === "internal") {
    return "עובד שלי";
  }
  return getName(data.subcontractors, employee.subcontractorId) || "ללא קבלן";
}

// Splits a set of employees into one group per affiliation (internal /
// each subcontractor) so a work-log record's employee list can be shown
// as "who worked for whom" (WorkHistory.jsx, WorkLog.jsx's recent-records
// list) instead of one flat name list — display grouping only, the
// underlying registration is still the single log it always was.
export function groupEmployeesByAffiliation(data, employeeList) {
  const groups = new Map();
  employeeList.forEach((employee) => {
    const isInternal = employee.type === "internal";
    const key = isInternal ? "internal" : String(employee.subcontractorId || "");
    if (!groups.has(key)) {
      groups.set(key, {
        label: getEmployeeAffiliationName(data, employee),
        employees: [],
        isInternal,
      });
    }
    groups.get(key).employees.push(employee);
  });
  // "עובד שלי" always leads; contractor groups keep their original
  // (stable) relative order after that.
  return Array.from(groups.values()).sort((a, b) => {
    if (a.isInternal === b.isInternal) return 0;
    return a.isInternal ? -1 : 1;
  });
}

export function getCurrentMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
  return {
    from: `${year}-${month}-01`,
    to: `${year}-${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Rolling window: 3 months ago (same day, clamped to that month's last day
// when it's shorter — e.g. "May 31" -> "Feb 28/29", not an overflow into
// March) through today.
export function getLastThreeMonthsRange() {
  const now = new Date();
  const targetMonth = now.getMonth() - 3;
  const lastDayOfTargetMonth = new Date(
    now.getFullYear(),
    targetMonth + 1,
    0
  ).getDate();
  const day = Math.min(now.getDate(), lastDayOfTargetMonth);
  const from = new Date(now.getFullYear(), targetMonth, day);
  return { from: formatLocalDate(from), to: formatLocalDate(now) };
}

export { normalizeDate };
