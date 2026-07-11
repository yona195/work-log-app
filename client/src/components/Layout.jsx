import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { NAV_ITEMS } from "../nav.js";
import Sidebar from "./Sidebar.jsx";
import Topbar from "./Topbar.jsx";

export default function Layout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  const current = NAV_ITEMS.find((item) => item.path === location.pathname);
  const title = current ? current.title : "יומן עבודה";

  // Close the mobile menu on route change and on Escape.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        className="menu-toggle"
        type="button"
        aria-label={menuOpen ? "סגירת תפריט" : "פתיחת תפריט"}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((v) => !v)}
      >
        {menuOpen ? "✕" : "☰"}
      </button>

      <div
        className={`menu-overlay${menuOpen ? " open" : ""}`}
        onClick={() => setMenuOpen(false)}
      ></div>

      <div className="app">
        <Sidebar open={menuOpen} onNavigate={() => setMenuOpen(false)} />
        <main className="main">
          <Topbar title={title} />
          <section id="content">{children}</section>
        </main>
      </div>
    </>
  );
}
