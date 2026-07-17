import { Router } from "express";
import { sendMonthlyEmployerReport } from "../lib/monthlyEmployerReport.js";

const router = Router();

// Triggered by an external cron service (Render's free tier has no built-in
// cron) — protected by a shared secret instead of the interactive login
// flow, since a scheduler can't do that.
router.post("/cron/monthly-employer-report", async (req, res) => {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret || req.header("x-cron-secret") !== expectedSecret) {
    return res.status(401).json({ error: "unauthorized" });
  }

  try {
    const result = await sendMonthlyEmployerReport();
    res.json(result);
  } catch (error) {
    console.error("Monthly employer report failed:", error);
    res.status(500).json({ error: "report-failed", message: error.message });
  }
});

export default router;
