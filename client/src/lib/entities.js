import { normalizeDate } from "./format.js";

export function getName(list, id) {
  const item = (list || []).find((x) => String(x.id) === String(id));
  return item ? item.name : "";
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

export { normalizeDate };
