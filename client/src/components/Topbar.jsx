import { useData } from "../state/DataProvider.jsx";
import { formatDateTime } from "../lib/format.js";

export default function Topbar({ title }) {
  const { data } = useData();
  const { previousLogin } = data;

  return (
    <header className="topbar">
      <div className="topbar-title">
        <h1>{title}</h1>
        <p>מערכת לניהול יומן עבודה</p>
      </div>

      <div className="topbar-brand">
        <img src="/logo.png" alt="לוגו החברה" className="topbar-logo" />
        {previousLogin && (
          <p className="topbar-last-login">
            כניסה קודמת:
            <br />
            {formatDateTime(previousLogin)}
          </p>
        )}
      </div>
    </header>
  );
}
