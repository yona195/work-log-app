import { api } from "../api.js";

export const NO_DATA_MESSAGE = "לא נמצאו נתונים עבור התקופה והבחירות שנבחרו.";

const LOADING_HTML = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<title>מכין את ה-PDF...</title>
<style>
  body { margin: 0; height: 100vh; display: flex; align-items: center; justify-content: center;
         background: #525659; color: #fff; font-family: Arial, sans-serif; font-size: 18px; }
</style>
</head>
<body><div>מכין את ה-PDF...</div></body>
</html>`;

function errorHtml(message) {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<title>שגיאה</title>
<style>
  body { margin: 0; height: 100vh; display: flex; align-items: center; justify-content: center;
         background: #fef2f2; color: #b91c1c; font-family: Arial, sans-serif; font-size: 18px;
         text-align: center; padding: 20px; box-sizing: border-box; }
</style>
</head>
<body><div>${message}</div></body>
</html>`;
}

/**
 * PDF export flow shared by every report type on both report pages: opens a
 * blank tab synchronously (before any await, so the browser never treats it
 * as a blocked popup), shows a Hebrew loading message in it, renders the
 * report HTML to a real PDF via the existing /api/pdf/render endpoint, then
 * navigates that same tab to the PDF so the browser's native viewer takes
 * over — nothing auto-prints or auto-downloads.
 *
 * `hasData` is checked synchronously (the caller already knows this from its
 * filtered logs) so an empty report never triggers generation — the blank
 * tab is just closed and the user sees an alert on the original page.
 */
export async function exportPdfInNewTab({ hasData, buildHtml, onLoadingChange }) {
  const newTab = window.open("", "_blank");

  if (!hasData) {
    if (newTab) newTab.close();
    alert(NO_DATA_MESSAGE);
    return;
  }

  if (!newTab) {
    alert("הדפדפן חסם את פתיחת הכרטיסייה. יש לאשר חלונות קופצים לאתר הזה ולנסות שוב.");
    return;
  }

  newTab.document.write(LOADING_HTML);
  newTab.document.close();

  onLoadingChange?.(true);
  try {
    const html = buildHtml();
    const blob = await api.renderPdf(html);
    const url = URL.createObjectURL(blob);
    newTab.location = url;
  } catch (error) {
    console.error("PDF export failed:", error);
    newTab.document.open();
    newTab.document.write(errorHtml("אירעה שגיאה בהפקת ה-PDF. נסה שוב."));
    newTab.document.close();
  } finally {
    onLoadingChange?.(false);
  }
}
