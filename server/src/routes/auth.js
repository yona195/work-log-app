import { Router } from "express";
import { authRequired, checkPassword, createToken } from "../auth.js";
import { getAppState, setAppState } from "../db.js";

const router = Router();
const protectedRouter = Router();

// Rolling 2-deep window: "previousLogin" is what "lastLogin" was right
// before this login, so the topbar can show "when was this touched before
// now" instead of the just-happened login being shown to itself. Runs for
// EVERY successful authentication — a fresh password login (below) and a
// silent resume from a stored token (protectedRouter, requireAuth already
// proved the token valid) both count.
async function recordLogin() {
  const priorLastLogin = await getAppState("lastLogin");
  await setAppState("previousLogin", priorLastLogin);
  await setAppState("lastLogin", new Date().toISOString());
}

// Whether the client needs to show a login screen at all.
router.get("/auth/status", (req, res) => {
  res.json({ authRequired });
});

router.post("/login", async (req, res) => {
  if (!authRequired) {
    return res.json({ token: null, authRequired: false });
  }
  if (checkPassword(req.body?.password)) {
    await recordLogin();
    return res.json({ token: createToken() });
  }
  res.status(401).json({ error: "סיסמה שגויה" });
});

// Tokens are stateless, so logout is handled client-side (discard the token).
// This endpoint exists for symmetry / future server-side revocation.
router.post("/logout", (req, res) => {
  res.json({ ok: true });
});

// Called once per app load when the client is resuming a session from a
// token already in storage (not a fresh password login, which already
// records this in /login above). Mounted behind requireAuth (see
// index.js), so reaching this handler at all already proves the token is
// valid — this just records that a session started, the same way a fresh
// login does.
protectedRouter.post("/auth/resume", async (req, res) => {
  await recordLogin();
  res.json({ ok: true });
});

export default router;
export { protectedRouter as protectedAuthRouter };
