import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Load server/.env if present (Node >= 20.12).
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env");
if (existsSync(envPath) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envPath);
}

import cors from "cors";
import express from "express";
import { authRequired, requireAuth, secretFromEnv } from "./auth.js";
import { initDb } from "./db.js";
import authRouter from "./routes/auth.js";
import dataRouter from "./routes/data.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Public auth endpoints (login / status / logout).
app.use("/api", authRouter);

// Everything else under /api requires a valid token (when auth is enabled).
app.use("/api", requireAuth, dataRouter);

// Serve the built React app (single-service production deployment).
const clientDist = resolve(__dirname, "..", "..", "client", "dist");
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // SPA fallback for any non-API route.
  app.get(/^(?!\/api\/).*/, (req, res) => {
    res.sendFile(join(clientDist, "index.html"));
  });
}

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("API error:", err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = Number(process.env.PORT) || 4000;

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Work log API listening on http://localhost:${PORT}`);
      if (!authRequired) {
        console.warn(
          "⚠️  Auth is DISABLED (set APP_PASSWORD to require login)."
        );
      } else if (!secretFromEnv) {
        console.warn(
          "⚠️  SESSION_SECRET not set — using a random secret; restarts will log everyone out."
        );
      }
    });
  })
  .catch((error) => {
    console.error("Failed to initialize database:", error);
    process.exit(1);
  });
