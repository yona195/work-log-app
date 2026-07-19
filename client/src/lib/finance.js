import { normalizeDate } from "./format.js";
import {
  getEmployeeAffiliationName,
  getEmployeeIds,
  getName,
} from "./entities.js";

/**
 * Resolve the rate that applies to an employee at a site, for a given
 * customer, on a given date. Priority: personal (employee) rate →
 * subcontractor rate. Internal employees must have a personal rate.
 * A rate only matches work logged for the same customer it was defined for.
 */
export function getApplicableRate(data, employee, siteId, workDate, customerId) {
  if (!employee || !siteId || !workDate) return null;

  const normalizedWorkDate = normalizeDate(workDate);
  const rates = Array.isArray(data.rates) ? data.rates : [];

  const validRates = rates
    .filter((rate) => {
      const rateDate = normalizeDate(rate.effectiveFrom);
      return (
        String(rate.siteId) === String(siteId) &&
        String(rate.customerId || "") === String(customerId || "") &&
        rateDate &&
        rateDate <= normalizedWorkDate
      );
    })
    .sort((a, b) =>
      normalizeDate(b.effectiveFrom).localeCompare(normalizeDate(a.effectiveFrom))
    );

  const employeeRate = validRates.find(
    (rate) =>
      rate.rateType === "employee" &&
      String(rate.employeeId || "") === String(employee.id)
  );
  if (employeeRate) return employeeRate;

  if (employee.type === "internal") return null;

  const subcontractorRate = validRates.find(
    (rate) =>
      rate.rateType === "subcontractor" &&
      String(rate.subcontractorId || "") ===
        String(employee.subcontractorId || "")
  );

  return subcontractorRate || null;
}

/**
 * Finance for a single work log, over a given set of employee ids.
 * `employeeIdsOverride` lets the reports page apply its own filtered set.
 */
export function calculateWorkLogFinance(data, log, employeeIdsOverride) {
  const result = {
    revenue: 0,
    cost: 0,
    profit: 0,
    employeeDays: 0,
    calculatedEmployees: [],
    missingRateEmployees: [],
  };
  if (!log) return result;

  const employeeIds = employeeIdsOverride || getEmployeeIds(log);

  employeeIds.forEach((employeeId) => {
    const employee = data.employees.find(
      (item) => String(item.id) === String(employeeId)
    );
    if (!employee) return;

    const rate = getApplicableRate(
      data,
      employee,
      log.siteId,
      log.date,
      log.customerId
    );
    if (!rate) {
      result.missingRateEmployees.push({
        employeeId: employee.id,
        employeeName: employee.name,
      });
      return;
    }

    const revenue = Number(rate.revenuePerWorker) || 0;
    const cost = Number(rate.costPerWorker) || 0;
    const profit = revenue - cost;

    result.revenue += revenue;
    result.cost += cost;
    result.profit += profit;
    result.employeeDays += 1;

    result.calculatedEmployees.push({
      employeeId: employee.id,
      employeeName: employee.name,
      rateId: rate.id,
      revenue,
      cost,
      profit,
    });
  });

  return result;
}

// Groups missing-rate warnings by employee+site+customer (not by date), so
// an employee missing a rate across many work days shows as one row with
// all the dates instead of one row per day.
export function getMissingRatesForLogs(data, logs) {
  const missingMap = new Map();

  logs.forEach((log) => {
    const finance = calculateWorkLogFinance(data, log);
    finance.missingRateEmployees.forEach((employee) => {
      const date = normalizeDate(log.date);
      const fullEmployee = data.employees.find(
        (item) => String(item.id) === String(employee.employeeId)
      );

      let affiliationName = "שיוך לא ידוע";
      if (fullEmployee) {
        affiliationName =
          fullEmployee.type === "internal"
            ? "עובד שלי"
            : getName(data.subcontractors, fullEmployee.subcontractorId) ||
              "ללא קבלן";
      }

      const key = [employee.employeeId, log.siteId, log.customerId].join("-");
      if (!missingMap.has(key)) {
        missingMap.set(key, {
          employeeName: employee.employeeName,
          affiliationName,
          siteName: getName(data.sites, log.siteId) || "אתר לא ידוע",
          customerName: getName(data.customers, log.customerId) || "מזמין לא ידוע",
          dates: new Set(),
        });
      }
      missingMap.get(key).dates.add(date);
    });
  });

  return Array.from(missingMap.values()).map((entry) => ({
    ...entry,
    dates: Array.from(entry.dates).sort(),
  }));
}

export { getEmployeeAffiliationName };
