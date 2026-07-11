// One-time migration: pull data from the legacy Google Apps Script endpoint
// and load it into the local SQLite database.
//
// Usage:
//   SHEETS_API_URL="https://script.google.com/.../exec" npm run import:sheets
//
// The URL can also be set in server/.env.

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env");
if (existsSync(envPath) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envPath);
}

const { importAll, initDb } = await import("./db.js");
await initDb();

const API_URL = process.env.SHEETS_API_URL;

if (!API_URL) {
  console.error(
    "SHEETS_API_URL is not set. Provide it via env or server/.env to import."
  );
  process.exit(1);
}

console.log("Fetching data from Google Sheets endpoint...");

try {
  const response = await fetch(`${API_URL}?action=getAll&t=${Date.now()}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Server responded with ${response.status}`);
  }

  const cloud = await response.json();

  const payload = {
    employees: cloud.employees || [],
    subcontractors: cloud.subcontractors || [],
    sites: cloud.sites || [],
    buildings: cloud.buildings || [],
    customers: cloud.customers || [],
    rates: cloud.rates || [],
    workLogs: cloud.workLogs || [],
  };

  const result = await importAll(payload);

  console.log("Imported successfully:");
  for (const [name, items] of Object.entries(result)) {
    console.log(`  ${name}: ${items.length}`);
  }
  process.exit(0);
} catch (error) {
  console.error("Import failed:", error.message);
  process.exit(1);
}
