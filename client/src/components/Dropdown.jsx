import { useEffect, useRef, useState } from "react";

// Generic click-to-toggle popover: renders `label` as a full-width trigger
// button and `children` in a panel underneath while open. Closes on an
// outside click or Escape.
export default function Dropdown({ label, children, className = "" }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const onOutsideClick = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const onKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onOutsideClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onOutsideClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={`dropdown-select ${className}`} ref={containerRef}>
      <button
        type="button"
        className="dropdown-select-trigger"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="dropdown-select-trigger-label">{label}</span>
        <span className="material-symbols-rounded dropdown-select-caret" aria-hidden="true">
          {open ? "expand_less" : "expand_more"}
        </span>
      </button>

      {open && <div className="dropdown-select-panel">{children}</div>}
    </div>
  );
}
