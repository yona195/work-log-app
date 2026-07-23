// One-time cleanup: merges redundant "run-length" duplicates in existing
// rate history. For each (employee, customer, site), rates are sorted by
// effectiveFrom; a run of CONSECUTIVE rates sharing the exact same pay
// (revenue+cost) is really one record, not several — this keeps only the
// earliest rate in each such run and deletes the rest. A later run that
// happens to revisit an earlier pay is NOT merged with that earlier run
// (a real change happened in between) — see client/src/lib/
// rateConsolidation.js, which this script reuses directly (plain JS, no
// React, safe to import from a server script).
//
// Defaults to a dry run (prints what WOULD be merged, changes nothing).
// Pass --commit to actually delete the redundant records.
//
// Usage:
//   node src/consolidate-rates.js              # dry run against DATABASE_URL/local db
//   node src/consolidate-rates.js --commit      # actually deletes
//
// DATABASE_URL/DATABASE_AUTH_TOKEN can be set in server/.env (see
// import-sheets.js for the same pattern) to point this at the production
// Turso database instead of the local dev SQLite file.

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env");
if (existsSync(envPath) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envPath);
}

const { getData, deleteItem, initDb } = await import("./db.js");
const { groupRatesForConsolidation, computeRuns } = await import(
  "../../client/src/lib/rateConsolidation.js"
);

await initDb();

const commit = process.argv.includes("--commit");

async function main() {
  const data = await getData();
  const { rates, employees, customers, sites } = data;

  const nameOf = (list, id) =>
    list.find((item) => String(item.id) === String(id))?.name || null;

  const buckets = groupRatesForConsolidation(rates);

  let mergedGroups = 0;
  let deletedCount = 0;

  for (const [key, bucketRates] of buckets.entries()) {
    const [employeeId, customerId, siteId] = key.split("|");
    const sorted = [...bucketRates].sort((a, b) =>
      String(a.effectiveFrom || "").localeCompare(String(b.effectiveFrom || ""))
    );
    const runs = computeRuns(sorted);

    for (const run of runs) {
      if (run.length < 2) continue;

      const [keep, ...remove] = run;
      const employeeName = nameOf(employees, employeeId) || `(עובד ${employeeId})`;
      const customerName = nameOf(customers, customerId) || "(ללא מזמין)";
      const siteName = nameOf(sites, siteId) || "(ללא אתר)";
      const dates = run.map((r) => r.effectiveFrom).join(", ");

      mergedGroups += 1;
      deletedCount += remove.length;

      console.log(
        `${commit ? "" : "[DRY RUN] "}${employeeName} · ${customerName} · ${siteName}: ` +
          `${run.length} רשומות זהות (${dates}) -> נשארת ${keep.effectiveFrom} (id ${keep.id}), ` +
          `${commit ? "נמחקות" : "יימחקו"}: ${remove.map((r) => `${r.id} (${r.effectiveFrom})`).join(", ")}`
      );

      if (commit) {
        for (const rate of remove) {
          // eslint-disable-next-line no-await-in-loop
          await deleteItem("rates", rate.id);
        }
      }
    }
  }

  console.log("");
  if (mergedGroups === 0) {
    console.log("לא נמצאו כפילויות למיזוג.");
    return;
  }
  console.log(
    `${commit ? "מוזגו" : "[DRY RUN] היו ממוזגות"} ${mergedGroups} קבוצות, ` +
      `${commit ? "נמחקו" : "היו נמחקות"} ${deletedCount} רשומות תעריף מיותרות.`
  );
  if (!commit) {
    console.log("להרצה בפועל: node src/consolidate-rates.js --commit");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
