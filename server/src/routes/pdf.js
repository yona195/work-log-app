import { Router } from "express";
import { buildPdfBuffer } from "../lib/pdfRenderer.js";

const router = Router();

// Renders an already-built report HTML string (produced client-side by the
// same buildXReportHtml functions used elsewhere) into a real PDF via
// headless Chrome, so the client can preview it in a drawer instead of
// relying on window.print(). Requires auth like the rest of /api (mounted
// behind requireAuth in index.js).
router.post("/pdf/render", async (req, res) => {
  const { html } = req.body || {};
  if (!html || typeof html !== "string") {
    return res.status(400).json({ error: "missing-html" });
  }

  try {
    const pdfBuffer = await buildPdfBuffer(html);
    res.setHeader("Content-Type", "application/pdf");
    // page.pdf() resolves to a Uint8Array, not a true Node Buffer — express's
    // res.send() only sends raw bytes for Buffer.isBuffer() === true,
    // otherwise it silently falls back to JSON-serializing the byte object.
    res.send(Buffer.from(pdfBuffer));
  } catch (error) {
    console.error("PDF render failed:", error);
    res.status(500).json({ error: "pdf-render-failed", message: error.message });
  }
});

export default router;
