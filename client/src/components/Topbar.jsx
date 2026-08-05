import { useData } from "../state/DataProvider.jsx";
import { formatDateTime } from "../lib/format.js";

export default function Topbar({ title, icon, menuOpen, onToggleMenu }) {
  const { data } = useData();
  const { previousLogin } = data;

  return (
    <header className="topbar">
      <div className="topbar-title">
        <button
          className={`menu-toggle${menuOpen ? " open" : ""}`}
          type="button"
          aria-label={menuOpen ? "סגירת תפריט" : "פתיחת תפריט"}
          aria-expanded={menuOpen}
          onClick={onToggleMenu}
        >
          <span className="material-symbols-rounded" aria-hidden="true">
            {menuOpen ? "close" : "menu"}
          </span>
        </button>
        <span className="material-symbols-rounded topbar-page-icon" aria-hidden="true">
          {icon}
        </span>
        <div className="topbar-title-text">
          <h1>{title}</h1>
        </div>
      </div>

      <div className="topbar-meta-group">
        {previousLogin && (
          <div className="topbar-last-login">
            <img src="/clock-icon.png" alt="שעון" className="topbar-last-login-icon" />
            <div className="topbar-last-login-text">
              <span className="topbar-last-login-label">כניסה אחרונה:</span>
              <span className="topbar-last-login-value">{formatDateTime(previousLogin)}</span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
