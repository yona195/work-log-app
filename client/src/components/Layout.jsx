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

  // Close the mobile menu and reset scroll on route change — React Router
  // doesn't do this on its own (unlike a full page navigation), so without
  // it a page opened via a link/navigate() keeps whatever scroll offset the
  // previous page was left at instead of opening at the top.
  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo(0, 0);
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
