import { normalizeDate } from "./format.js";
import { getEmployeeIds } from "./entities.js";
import { getApplicableRate } from "./finance.js";

/**
 * Employees of a log that match the report filters.
 * filters: { group, subcontractorId, employeeId }
 */
export function getReportEmployees(data, log, filters) {
  const { group = "", subcontractorId = "", employeeId = "" } = filters;
  const employeeIds = getEmployeeIds(log);

  return data.employees.filter((employee) => {
    const existsInLog = employeeIds.includes(String(employee.id));
    const isInternal = employee.type === "internal";
    const isSubcontractorEmployee =
      employee.type === "subcontractor" || employee.type === "external";

    let matchesGroup = true;
    if (group === "internal") matchesGroup = isInternal;
    if (group === "all-subcontractors") matchesGroup = isSubcontractorEmployee;

    const matchesSubcontractor =
      !subcontractorId ||
      String(employee.subcontractorId || "") === String(subcontractorId);

    const matchesEmployee =
      !employeeId || String(employee.id) === String(employeeId);

    return (
      existsInLog && matchesGroup && matchesSubcontractor && matchesEmployee
    );
  });
}

/**
 * Logs that match the report filters.
 * filters: { from, to, siteId, customerId, group, subcontractorId, employeeId }
 */
export function filterReportLogs(data, filters) {
  const { from = "", to = "", siteId = "", customerId = "" } = filters;

  return data.workLogs.filter((log) => {
    const logDate = normalizeDate(log.date);
    const reportEmployees = getReportEmployees(data, log, filters);

    return (
      (!from || logDate >= from) &&
      (!to || logDate <= to) &&
      (!siteId || String(log.siteId) === String(siteId)) &&
      (!customerId || String(log.customerId) === String(customerId)) &&
      reportEmployees.length > 0
    );
  });
}

/** Finance for a log using only the report-filtered employees. */
export function calculateFilteredWorkLogFinance(data, log, filters) {
  const reportEmployees = getReportEmployees(data, log, filters);
  const result = {
    revenue: 0,
    cost: 0,
    profit: 0,
    employeeDays: 0,
    calculatedEmployees: [],
    missingRateEmployees: [],
  };

  reportEmployees.forEach((employee) => {
    const rate = getApplicableRate(data, employee, log.siteId, log.date);
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
