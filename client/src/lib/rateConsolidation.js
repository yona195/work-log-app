// Shared "run-length" model for one employee's rate history at one
// customer+site: sorted by effectiveFrom, a "run" is a maximal sequence of
// CONSECUTIVE records that all share the same pay (revenue+cost). Each run
// should really be a single record — a later run that happens to revisit
// an earlier run's pay is still a separate run (a real change happened in
// between), never merged back into the earlier one.
//
// Used by (1) Rates.jsx's add-rate flow, to avoid creating a redundant
// record that a run already covers, and (2) the one-time cleanup script,
// to collapse pre-existing redundant runs in stored data.

const samePay = (a, b) =>
  Number(a.revenuePerWorker) === Number(b.revenuePerWorker) &&
  Number(a.costPerWorker) === Number(b.costPerWorker);

// `sortedRates` must already be sorted ascending by effectiveFrom (ISO
// date strings sort correctly with plain string comparison). Returns an
// array of runs, each run itself an array of rates in chronological order.
export function computeRuns(sortedRates) {
  const runs = [];
  for (const rate of sortedRates) {
    const currentRun = runs[runs.length - 1];
    if (currentRun && samePay(currentRun[currentRun.length - 1], rate)) {
      currentRun.push(rate);
    } else {
      runs.push([rate]);
    }
  }
  return runs;
}

// Buckets `rates` by employee+customer+site+archived (only rateType
// "employee" rates have a meaningful per-employee history; legacy
// subcontractor-level rates are left out). Archived status is part of the
// bucket key deliberately — an archived record represents a deliberately
// closed period, so it's never silently folded into an active run or vice
// versa.
export function groupRatesForConsolidation(rates) {
  const buckets = new Map();
  rates
    .filter((r) => r.rateType === "employee" && r.employeeId)
    .forEach((rate) => {
      const key = [
        String(rate.employeeId),
        String(rate.customerId || ""),
        String(rate.siteId || ""),
        rate.archived ? "archived" : "active",
      ].join("|");
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(rate);
    });
  return buckets;
}

// Given one employee+customer+site's EXISTING rates (any order) and a
// candidate new record (date + pay), decides what a new addition should
// do so it never creates an unnecessary broken run:
//
// - "skip": some existing record already covers `newDate` with the same
//   pay (the closest record at-or-before `newDate` matches) — adding
//   anything here would be a pure duplicate.
// - "extend": `newDate` is earlier than every existing record, and the
//   earliest existing record has the same pay — that record's run really
//   starts at `newDate`, so it should be pulled back instead of adding a
//   second record for the same run.
// - "create": a genuinely new period (different pay from whatever was in
//   effect at `newDate`, or the very first record ever for this bucket).
export function findRedundantAt(existingRates, newDateISO, revenue, cost) {
  const candidate = { revenuePerWorker: revenue, costPerWorker: cost };
  const sorted = [...existingRates].sort((a, b) =>
    String(a.effectiveFrom || "").localeCompare(String(b.effectiveFrom || ""))
  );

  let prev = null;
  let next = null;
  for (const rate of sorted) {
    const date = String(rate.effectiveFrom || "");
    if (date <= newDateISO) {
      if (!prev || date > String(prev.effectiveFrom || "")) prev = rate;
    } else if (!next || date < String(next.effectiveFrom || "")) {
      next = rate;
    }
  }

  if (prev && samePay(prev, candidate)) return { action: "skip", anchor: prev };
  if (!prev && next && samePay(next, candidate)) return { action: "extend", anchor: next };
  return { action: "create" };
}
