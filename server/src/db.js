import { createClient } from "@libsql/client";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// In production, DATABASE_URL points at a Turso database (libsql://…) with
// DATABASE_AUTH_TOKEN. In development we fall back to a local SQLite file.
function resolveConfig() {
  const url = process.env.DATABASE_URL;
  if (url) {
    return { url, authToken: process.env.DATABASE_AUTH_TOKEN };
  }
  const filePath = resolve(
    __dirname,
    "..",
    process.env.DATABASE_PATH || "./data/work-log.db"
  );
  mkdirSync(dirname(filePath), { recursive: true });
  return { url: `file:${filePath}` };
}

const client = createClient(resolveConfig());

/* =========================================
   Collection definitions
========================================= */

export const COLLECTIONS = {
  subcontractors: { table: "subcontractors", columns: ["name"], json: [] },
  sites: { table: "sites", columns: ["name"], json: [] },
  customers: { table: "customers", columns: ["name"], json: [] },
  employees: {
    table: "employees",
    columns: ["name", "type", "subcontractorId"],
    json: [],
  },
  buildings: { table: "buildings", columns: ["siteId", "name"], json: [] },
  rates: {
    table: "rates",
    columns: [
      "siteId",
      "rateType",
      "employeeId",
      "subcontractorId",
      "customerId",
      "revenuePerWorker",
      "costPerWorker",
      "effectiveFrom",
    ],
    json: [],
  },
  workLogs: {
    table: "work_logs",
    columns: [
      "date",
      "employeeIds",
      "buildingIds",
      "siteId",
      "customerId",
      "notes",
    ],
    json: ["employeeIds", "buildingIds"],
  },
};

export const COLLECTION_NAMES = Object.keys(COLLECTIONS);

/* =========================================
   Schema — created once on startup.
========================================= */

export async function initDb() {
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS subcontractors (
      id   TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sites (
      id   TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS customers (
      id   TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS employees (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      type            TEXT NOT NULL DEFAULT 'internal',
      subcontractorId TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS buildings (
      id     TEXT PRIMARY KEY,
      siteId TEXT NOT NULL,
      name   TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS rates (
      id               TEXT PRIMARY KEY,
      siteId           TEXT NOT NULL DEFAULT '',
      rateType         TEXT NOT NULL DEFAULT '',
      employeeId       TEXT NOT NULL DEFAULT '',
      subcontractorId  TEXT NOT NULL DEFAULT '',
      revenuePerWorker REAL NOT NULL DEFAULT 0,
      costPerWorker    REAL NOT NULL DEFAULT 0,
      effectiveFrom    TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS work_logs (
      id          TEXT PRIMARY KEY,
      date        TEXT NOT NULL DEFAULT '',
      employeeIds TEXT NOT NULL DEFAULT '[]',
      buildingIds TEXT NOT NULL DEFAULT '[]',
      siteId      TEXT NOT NULL DEFAULT '',
      customerId  TEXT NOT NULL DEFAULT '',
      notes       TEXT NOT NULL DEFAULT ''
    );
  `);

  // rates.customerId was added after the initial release; back-fill it on
  // databases created before this column existed.
  try {
    await client.execute(
      `ALTER TABLE rates ADD COLUMN customerId TEXT NOT NULL DEFAULT ''`
    );
  } catch (err) {
    if (!/duplicate column/i.test(err.message)) throw err;
  }
}

/* =========================================
   Helpers
========================================= */

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function serializeValue(def, column, value) {
  if (def.json.includes(column)) {
    return JSON.stringify(Array.isArray(value) ? value : []);
  }
  if (value === undefined || value === null) return "";
  return value;
}

// Normalizes a legacy JSON-column value (array | JSON string | csv) to a
// JSON array string for storage.
function normalizeJsonColumn(raw) {
  if (Array.isArray(raw)) return JSON.stringify(raw);
  try {
    const parsed = JSON.parse(raw);
    return JSON.stringify(Array.isArray(parsed) ? parsed : []);
  } catch {
    return JSON.stringify(
      String(raw || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    );
  }
}

function deserializeRow(def, row) {
  if (!row) return row;
  const result = { ...row };
  for (const column of def.json) {
    try {
      const parsed = JSON.parse(result[column]);
      result[column] = Array.isArray(parsed) ? parsed : [];
    } catch {
      result[column] = [];
    }
  }
  return result;
}

/* =========================================
   Generic CRUD (async)
========================================= */

export async function listAll(collection) {
  const def = COLLECTIONS[collection];
  const { rows } = await client.execute(`SELECT * FROM ${def.table}`);
  return rows.map((row) => deserializeRow(def, { ...row }));
}

export async function getData() {
  const data = {};
  for (const name of COLLECTION_NAMES) {
    // eslint-disable-next-line no-await-in-loop
    data[name] = await listAll(name);
  }
  return data;
}

async function getById(def, id) {
  const { rows } = await client.execute({
    sql: `SELECT * FROM ${def.table} WHERE id = ?`,
    args: [String(id)],
  });
  return rows[0] ? deserializeRow(def, { ...rows[0] }) : null;
}

export async function createItem(collection, body = {}) {
  const def = COLLECTIONS[collection];
  const id = body.id ? String(body.id) : generateId();
  const columns = ["id", ...def.columns];
  const args = [
    id,
    ...def.columns.map((column) => serializeValue(def, column, body[column])),
  ];
  const placeholders = columns.map(() => "?").join(", ");

  await client.execute({
    sql: `INSERT INTO ${def.table} (${columns.join(", ")}) VALUES (${placeholders})`,
    args,
  });

  return getById(def, id);
}

export async function updateItem(collection, id, body = {}) {
  const def = COLLECTIONS[collection];
  const existing = await getById(def, id);
  if (!existing) return null;

  const updates = def.columns.filter((column) => column in body);
  if (updates.length > 0) {
    const setClause = updates.map((column) => `${column} = ?`).join(", ");
    const args = [
      ...updates.map((column) => serializeValue(def, column, body[column])),
      String(id),
    ];
    await client.execute({
      sql: `UPDATE ${def.table} SET ${setClause} WHERE id = ?`,
      args,
    });
  }

  return getById(def, id);
}

export async function deleteItem(collection, id) {
  const def = COLLECTIONS[collection];
  const result = await client.execute({
    sql: `DELETE FROM ${def.table} WHERE id = ?`,
    args: [String(id)],
  });
  return result.rowsAffected > 0;
}

/* =========================================
   Bulk replace (migration / restore) — atomic batch.
========================================= */

export async function importAll(payload = {}) {
  const statements = [];

  for (const name of COLLECTION_NAMES) {
    const def = COLLECTIONS[name];
    statements.push({ sql: `DELETE FROM ${def.table}`, args: [] });

    const items = Array.isArray(payload[name]) ? payload[name] : [];
    for (const item of items) {
      const id = item.id ? String(item.id) : generateId();
      const columns = ["id", ...def.columns];
      const args = [
        id,
        ...def.columns.map((column) =>
          def.json.includes(column)
            ? normalizeJsonColumn(item[column])
            : serializeValue(def, column, item[column])
        ),
      ];
      const placeholders = columns.map(() => "?").join(", ");
      statements.push({
        sql: `INSERT INTO ${def.table} (${columns.join(", ")}) VALUES (${placeholders})`,
        args,
      });
    }
  }

  await client.batch(statements, "write");
  return getData();
}

export default client;
