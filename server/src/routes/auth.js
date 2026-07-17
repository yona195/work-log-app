import { Router } from "express";
import { authRequired, checkPassword, createToken } from "../auth.js";
import { getAppState, setAppState } from "../db.js";

const router = Router();

// Whether the client needs to show a login screen at all.
router.get("/auth/status", (req, res) => {
  res.json({ authRequired });
});

router.post("/login", async (req, res) => {
  if (!authRequired) {
    return res.json({ token: null, authRequired: false });
  }
  if (checkPassword(req.body?.password)) {
    // Rolling 2-deep window: "previousLogin" is what "lastLogin" was right
    // before this login, so the topbar can show "when was this touched
    // before now" instead of the just-happened login being shown to itself.
    const priorLastLogin = await getAppState("lastLogin");
    await setAppState("previousLogin", priorLastLogin);
    await setAppState("lastLogin", new Date().toISOString());
    return res.json({ token: createToken() });
  }
  res.status(401).json({ error: "סיסמה שגויה" });
});

// Tokens are stateless, so logout is handled client-side (discard the token).
// This endpoint exists for symmetry / future server-side revocation.
router.post("/logout", (req, res) => {
  res.json({ ok: true });
});

export default router;
