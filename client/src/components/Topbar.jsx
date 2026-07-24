import { useData } from "../state/DataProvider.jsx";
import { formatDateTime } from "../lib/format.js";

export default function Topbar({ title }) {
  const { data } = useData();
  const { previousLogin } = data;

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <img src="/logo.png" alt="לוגו החברה" className="topbar-logo" />
        <div className="topbar-title">
          <h1>{title}</h1>
          <p>מערכת לניהול יומן עבודה</p>
        </div>
      </div>

      {previousLogin && (
        <div className="topbar-last-login">
          <span className="material-symbols-rounded topbar-last-login-icon" aria-hidden="true">
            schedule
          </span>
          <div className="topbar-last-login-text">
            <span className="topbar-last-login-label">כניסה אחרונה</span>
            <span className="topbar-last-login-value">{formatDateTime(previousLogin)}</span>
          </div>
        </div>
      )}
    </header>
  );
}
