# יומן עבודה — Work Log App

A work-log management system (Hebrew / RTL) for tracking daily crews, sites,
buildings, customers, date-effective rates, and the resulting revenue / cost /
profit. Rebuilt as a **React** frontend backed by a **Node + Express + SQLite**
REST API. Fully self-hosted and free — no third-party services required.

## Structure

```
work-log-app/
├── client/          React + Vite frontend (RTL UI, Chart.js, PDF & Excel export)
├── server/          Express + SQLite REST API
│   └── data/        SQLite database file lives here (gitignored)
├── legacy/          The original vanilla-JS + Google Sheets app (kept for reference)
└── package.json     npm workspaces + dev scripts
```

## Prerequisites

- Node.js 20.12+ (developed on Node 25)

## Setup

```bash
npm run install:all
```

## Run (development)

Starts the API (port 4000) and the Vite dev server (port 5173) together.
Vite proxies `/api` to the backend.

```bash
npm run dev
```

Then open http://localhost:5173

Run them separately if you prefer:

```bash
npm run dev:server
npm run dev:client
```

## Build (production)

```bash
npm run build          # builds client/dist
npm run start          # serves the API; host client/dist behind any static server
```

## Migrating existing data from Google Sheets

The old app synced to a Google Apps Script endpoint. To pull that data into the
local SQLite database once:

```bash
SHEETS_API_URL="https://script.google.com/macros/s/…/exec" npm run import:sheets
```

(or set `SHEETS_API_URL` in `server/.env` — see `server/.env.example`.)

## Deployment (free)

The app deploys as a **single Node service** that serves both the API and the
built React app. Storage is **Turso** (free, hosted, SQLite-compatible), so no
persistent disk is required — it runs on any free host.

### 1. Create the Turso database (one time)

```bash
# install the CLI: https://docs.turso.tech/cli/installation
turso auth signup
turso db create work-log
turso db show work-log --url          # -> DATABASE_URL
turso db tokens create work-log       # -> DATABASE_AUTH_TOKEN
```

### 2. Choose a login password

Set `APP_PASSWORD` to any shared password — the app shows a login screen and
users enter it there (with a Logout button in the sidebar). Also set
`SESSION_SECRET` to a long random string so logins survive restarts. Auth is
enforced only when `APP_PASSWORD` is set — dev stays open.

### 3. Deploy

**Render** (uses `render.yaml`): New → Blueprint → point at the repo → set the
env vars (`DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `APP_PASSWORD`) in the
dashboard (`SESSION_SECRET` is generated automatically) → deploy.

**Fly.io / any Docker host** (uses `Dockerfile`):

```bash
fly launch --no-deploy
fly secrets set DATABASE_URL="libsql://…" DATABASE_AUTH_TOKEN="…" \
               APP_PASSWORD="your-password" SESSION_SECRET="$(openssl rand -hex 32)"
fly deploy
```

### 4. Load your data

Point the running service (or a local run with the prod env vars) at your old
Google Sheets once: `SHEETS_API_URL="…/exec" npm run import:sheets`.

### Test the production build locally

```bash
npm run build
APP_PASSWORD=secret SESSION_SECRET=dev-secret npm start
# open http://localhost:4000 — one port serves API + app, shows a login screen
```

### Environment variables

| Variable              | Purpose                                            |
| --------------------- | -------------------------------------------------- |
| `PORT`                | Port to listen on (host sets this)                 |
| `DATABASE_URL`        | Turso libSQL URL (empty → local SQLite file)       |
| `DATABASE_AUTH_TOKEN` | Turso auth token                                   |
| `APP_PASSWORD`        | Shared login password (enables auth when set)      |
| `SESSION_SECRET`      | Signs session tokens; set for stable logins        |
| `SHEETS_API_URL`      | Legacy endpoint, only for `import:sheets`          |

## API

| Method | Path                     | Description                          |
| ------ | ------------------------ | ------------------------------------ |
| GET    | `/api/health`            | Health check                         |
| GET    | `/api/data`              | Full snapshot of every collection    |
| POST   | `/api/:collection`       | Create an item                       |
| PUT    | `/api/:collection/:id`   | Update an item                       |
| DELETE | `/api/:collection/:id`   | Delete an item                       |
| POST   | `/api/import`            | Bulk replace all collections         |

Collections: `employees`, `subcontractors`, `sites`, `buildings`,
`customers`, `rates`, `workLogs`.

## Data model

- **employees** — `{ id, name, type: "internal" | "subcontractor", subcontractorId }`
- **subcontractors / sites / customers** — `{ id, name }`
- **buildings** — `{ id, siteId, name }`
- **rates** — `{ id, siteId, rateType: "employee" | "subcontractor", employeeId, subcontractorId, revenuePerWorker, costPerWorker, effectiveFrom }`
- **workLogs** — `{ id, date, employeeIds[], buildingIds[], siteId, customerId, notes }`

Rate resolution: a personal (employee) rate wins over a subcontractor rate;
internal employees require a personal rate; the most recent rate effective on or
before the work date is used.
