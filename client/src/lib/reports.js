import { normalizeDate, formatMonthLabel } from "./format.js";
import {
  getEmployeeIds,
  getName,
  getBuildingNames,
  getEmployeeAffiliationName,
} from "./entities.js";
import { getApplicableRate } from "./finance.js";

/**
 * Groups logs by calendar month (year-month), sorted chronologically.
 * Returns [{ key: "2026-07", label: "יולי 2026", logs: [...] }, ...]
 */
export function groupLogsByMonth(logs) {
  const sortedLogs = [...logs].sort((a, b) =>
    normalizeDate(a.date).localeCompare(normalizeDate(b.date))
  );

  const groups = new Map();
  sortedLogs.forEach((log) => {
    const [yearStr, monthStr] = normalizeDate(log.date).split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    // Zero-pad explicitly: legacy imported dates aren't always "YYYY-MM-DD",
    // so naive string-slicing can split the same month into two differently
    // keyed groups whose labels collide and crash the Excel export.
    const key =
      yearStr && Number.isInteger(year) && Number.isInteger(month)
        ? `${yearStr.padStart(4, "0")}-${String(month).padStart(2, "0")}`
        : "unknown";
    const label = key === "unknown" ? "ללא תאריך" : formatMonthLabel(key);
    if (!groups.has(key)) {
      groups.set(key, { key, label, logs: [] });
    }
    groups.get(key).logs.push(log);
  });

  return Array.from(groups.values()).sort((a, b) => a.key.localeCompare(b.key));
}

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

/**
 * Financial summary (totals + breakdowns by workforce/site/customer, plus
 * missing-rate warnings) over a set of report-filtered logs. Shared between
 * the on-screen summary view and the employer PDF/Excel exports, which each
 * call it once per month group.
 */
export function calculateFinancialSummary(data, logs, filters) {
  let totalRevenue = 0;
  let totalCost = 0;
  let totalProfit = 0;
  const workforceGroups = {};
  const siteGroups = {};
  const customerGroups = {};
  const missingRates = [];

  logs.forEach((log) => {
    const finance = calculateFilteredWorkLogFinance(data, log, filters);
    totalRevenue += finance.revenue;
    totalCost += finance.cost;
    totalProfit += finance.profit;

    const siteId = String(log.siteId || "");
    const siteName = getName(data.sites, log.siteId) || "אתר לא ידוע";
    if (!siteGroups[siteId]) {
      siteGroups[siteId] = { name: siteName, revenue: 0, cost: 0, profit: 0 };
    }
    siteGroups[siteId].revenue += finance.revenue;
    siteGroups[siteId].cost += finance.cost;
    siteGroups[siteId].profit += finance.profit;

    const customerId = String(log.customerId || "");
    const customerName = getName(data.customers, log.customerId) || "מזמין לא ידוע";
    if (!customerGroups[customerId]) {
      customerGroups[customerId] = { name: customerName, revenue: 0, cost: 0, profit: 0 };
    }
    customerGroups[customerId].revenue += finance.revenue;
    customerGroups[customerId].cost += finance.cost;
    customerGroups[customerId].profit += finance.profit;

    finance.calculatedEmployees.forEach((calc) => {
      const employee = data.employees.find(
        (e) => String(e.id) === String(calc.employeeId)
      );
      if (!employee) return;
      let groupKey;
      let groupName;
      if (employee.type === "internal") {
        groupKey = "internal";
        groupName = "העובדים שלי";
      } else {
        groupKey = `subcontractor-${employee.subcontractorId}`;
        groupName =
          getName(data.subcontractors, employee.subcontractorId) || "קבלן לא ידוע";
      }
      if (!workforceGroups[groupKey]) {
        workforceGroups[groupKey] = {
          name: groupName,
          revenue: 0,
          cost: 0,
          profit: 0,
        };
      }
      workforceGroups[groupKey].revenue += calc.revenue;
      workforceGroups[groupKey].cost += calc.cost;
      workforceGroups[groupKey].profit += calc.profit;
    });

    finance.missingRateEmployees.forEach((missing) => {
      const employee = data.employees.find(
        (e) => String(e.id) === String(missing.employeeId)
      );
      missingRates.push({
        employeeName: missing.employeeName,
        affiliationName: employee
          ? getEmployeeAffiliationName(data, employee)
          : "שיוך לא ידוע",
        siteName: getName(data.sites, log.siteId) || "אתר לא ידוע",
        date: normalizeDate(log.date),
      });
    });
  });

  return {
    totalRevenue,
    totalCost,
    totalProfit,
    workforce: Object.values(workforceGroups),
    sites: Object.values(siteGroups),
    customers: Object.values(customerGroups),
    missingRates,
  };
}

/**
 * Employer breakdown for the PDF/Excel employer report: one table per
 * workforce group (internal employees, then each subcontractor), each with
 * one row per log — same shape as the customer report row, plus per-row
 * cost/payment/profit — and a totals row summed over the group.
 * Returns [{ key, name, rows: [...], totalCost, totalRevenue, totalProfit }],
 * internal group first, subcontractors alphabetically after.
 */
export function calculateEmployerBreakdown(data, logs, filters) {
  const groups = new Map();

  logs.forEach((log) => {
    const reportEmployees = getReportEmployees(data, log, filters);
    const employeesByGroup = new Map();

    reportEmployees.forEach((employee) => {
      const groupKey =
        employee.type === "internal"
          ? "internal"
          : `subcontractor-${employee.subcontractorId}`;
      if (!employeesByGroup.has(groupKey)) employeesByGroup.set(groupKey, []);
      employeesByGroup.get(groupKey).push(employee);
    });

    employeesByGroup.forEach((groupEmployees, groupKey) => {
      let rowCost = 0;
      let rowRevenue = 0;
      let rowProfit = 0;

      groupEmployees.forEach((employee) => {
        const rate = getApplicableRate(
          data,
          employee,
          log.siteId,
          log.date,
          log.customerId
        );
        if (!rate) return;
        const revenue = Number(rate.revenuePerWorker) || 0;
        const cost = Number(rate.costPerWorker) || 0;
        rowRevenue += revenue;
        rowCost += cost;
        rowProfit += revenue - cost;
      });

      if (!groups.has(groupKey)) {
        const name =
          groupKey === "internal"
            ? "העובדים שלי"
            : getName(data.subcontractors, groupEmployees[0].subcontractorId) ||
              "קבלן לא ידוע";
        groups.set(groupKey, {
          key: groupKey,
          name,
          rows: [],
          totalCost: 0,
          totalRevenue: 0,
          totalProfit: 0,
        });
      }

      const groupData = groups.get(groupKey);
      groupData.rows.push({
        date: normalizeDate(log.date),
        employeeNames: groupEmployees.map((e) => e.name).join(", "),
        employeeCount: groupEmployees.length,
        site: getName(data.sites, log.siteId),
        buildings: getBuildingNames(data, log),
        customer: getName(data.customers, log.customerId),
        notes: log.notes || "",
        cost: rowCost,
        revenue: rowRevenue,
        profit: rowProfit,
      });
      groupData.totalCost += rowCost;
      groupData.totalRevenue += rowRevenue;
      groupData.totalProfit += rowProfit;
    });
  });

  return Array.from(groups.values()).sort((a, b) => {
    if (a.key === "internal") return -1;
    if (b.key === "internal") return 1;
    return a.name.localeCompare(b.name, "he");
  });
}
