import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";

// Renders `html` (an already-built report string) to a real PDF server-side
// and previews it in a left-side drawer (full-screen on mobile), instead of
// the old window.print() flow. Printing/downloading act on the already-
// generated PDF — nothing reopens window.print() until "הדפסה" is clicked.
export default function PdfPreviewDrawer({ open, html, fileName, onClose }) {
  const [status, setStatus] = useState("idle"); // idle | loading | ready | error
  const [blobUrl, setBlobUrl] = useState("");
  const [blob, setBlob] = useState(null);
  const iframeRef = useRef(null);

  useEffect(() => {
    if (!open || !html) return undefined;

    let cancelled = false;
    let localUrl = "";
    setStatus("loading");
    setBlob(null);
    setBlobUrl("");

    api
      .renderPdf(html)
      .then((pdfBlob) => {
        if (cancelled) return;
        localUrl = URL.createObjectURL(pdfBlob);
        setBlob(pdfBlob);
        setBlobUrl(localUrl);
        setStatus("ready");
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("PDF render failed:", error);
        setStatus("error");
      });

    return () => {
      cancelled = true;
      if (localUrl) URL.revokeObjectURL(localUrl);
    };
  }, [open, html]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handlePrint = () => {
    iframeRef.current?.contentWindow?.print();
  };

  const handleDownload = async () => {
    if (!blob) return;
    const { saveAs } = await import("file-saver");
    saveAs(blob, `${fileName}.pdf`);
  };

  return (
    <>
      <div className="pdf-drawer-overlay" onClick={onClose} />
      <div
        className="pdf-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`תצוגה מקדימה - ${fileName}`}
      >
        <div className="pdf-drawer-toolbar">
          <span className="pdf-drawer-title">{fileName}</span>
          <div className="pdf-drawer-actions">
            <button type="button" className="secondary-btn" onClick={onClose}>
              סגירה
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={handleDownload}
              disabled={status !== "ready"}
            >
              הורדת PDF
            </button>
            <button
              type="button"
              className="primary-btn"
              onClick={handlePrint}
              disabled={status !== "ready"}
            >
              הדפסה
            </button>
          </div>
        </div>

        <div className="pdf-drawer-body">
          {status === "loading" && (
            <div className="pdf-drawer-status">מכין את ה-PDF...</div>
          )}
          {status === "error" && (
            <div className="pdf-drawer-status pdf-drawer-error">
              אירעה שגיאה בהפקת ה-PDF. נסה שוב.
            </div>
          )}
          {status === "ready" && (
            <iframe
              ref={iframeRef}
              src={blobUrl}
              title={fileName}
              className="pdf-drawer-frame"
            />
          )}
        </div>
      </div>
    </>
  );
}
