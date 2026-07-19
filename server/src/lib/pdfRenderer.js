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
    await page.setContent(html, { waitUntil: "networkidle0" });
    return await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
    });
  } finally {
    await browser.close();
  }
}
