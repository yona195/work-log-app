// Shared-password auth using a signed, expiring token sent as a Bearer header.
//
// Auth is enforced only when APP_PASSWORD is set — so local development stays
// open. Set SESSION_SECRET in production for stable tokens across restarts;
// otherwise a random secret is generated at startup (restart = everyone must
// re-login).

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const PASSWORD = process.env.APP_PASSWORD || "";
export const authRequired = Boolean(PASSWORD);

const SECRET = process.env.SESSION_SECRET || randomBytes(32).toString("hex");
export const secretFromEnv = Boolean(process.env.SESSION_SECRET);

const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function sign(value) {
  return createHmac("sha256", SECRET).update(value).digest("hex");
}

function safeEqual(a, b) {
  const bufferA = Buffer.from(String(a));
  const bufferB = Buffer.from(String(b));
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

export function createToken() {
  const exp = String(Date.now() + TOKEN_TTL_MS);
  return `${exp}.${sign(exp)}`;
}

export function verifyToken(token) {
  if (!token) return false;
  const index = token.lastIndexOf(".");
  if (index < 0) return false;
  const exp = token.slice(0, index);
  const signature = token.slice(index + 1);
  if (!safeEqual(signature, sign(exp))) return false;
  return Number(exp) > Date.now();
}

export function checkPassword(password) {
  if (!authRequired) return false;
  return safeEqual(password, PASSWORD);
}

export function requireAuth(req, res, next) {
  if (!authRequired) return next();
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (verifyToken(token)) return next();
  res.status(401).json({ error: "Unauthorized" });
}
