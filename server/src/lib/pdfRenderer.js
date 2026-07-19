import puppeteer from "puppeteer";

// Launching a fresh Chromium process per request was the dominant cost of
// PDF export on Render (~14s cold-launch vs ~0.5-1s once warm) — the
// browser process itself is now launched once and reused; each request
// still gets its own page (closed when done) so requests stay isolated.
let browserPromise = null;

async function getBrowser() {
  if (browserPromise) {
    const browser = await browserPromise;
    if (browser.connected) return browser;
    browserPromise = null; // died since last use — relaunch below
  }

  browserPromise = puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  // A failed launch shouldn't be cached forever — let the next call retry.
  browserPromise.catch(() => {
    browserPromise = null;
  });

  return browserPromise;
}

export async function buildPdfBuffer(html) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    return await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
    });
  } finally {
    await page.close();
  }
}

// Best-effort cleanup for graceful shutdown (SIGTERM/SIGINT) — not required
// for correctness (the OS reclaims the process either way), just avoids
// leaving a headless Chromium process behind during a deploy/restart.
export async function closeBrowser() {
  if (!browserPromise) return;
  try {
    const browser = await browserPromise;
    await browser.close();
  } catch {
    // Already gone — nothing to do.
  } finally {
    browserPromise = null;
  }
}
