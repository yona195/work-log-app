import puppeteer from "puppeteer";

// Renders an already-built HTML report string into a real PDF buffer via
// headless Chrome — shared by the monthly employer-report email and the
// on-demand "ייצוא PDF" preview endpoint, so both produce byte-identical
// output for the same HTML.
export async function buildPdfBuffer(html) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    // The report HTML is fully self-contained (inline <style>, no external
    // images/fonts/scripts), so there's nothing for the network to ever go
    // idle from — "networkidle0" is a condition that can hang indefinitely
    // with setContent() in constrained/sandboxed environments and was the
    // actual cause of the reported "Navigation timeout of 30000 ms
    // exceeded" failures. "domcontentloaded" fires as soon as the DOM
    // (including inline styles) finishes parsing, which is all page.pdf()
    // needs here, and resolves immediately instead of waiting on a network
    // condition that never applies.
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    return await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
    });
  } finally {
    await browser.close();
  }
}
