import { useData } from "../state/DataProvider.jsx";

export default function Topbar({ title }) {
  const { phase, sync, reload } = useData();

  let statusText = "🟢 מסונכרן";
  if (phase === "loading") statusText = "🔄 טוען נתונים...";
  else if (sync === "saving") statusText = "🟡 שומר...";
  else if (sync === "error") statusText = "🔴 שגיאת שמירה";

  return (
    <header className="topbar">
      <h1>{title}</h1>
      <p>מערכת לניהול יומן עבודה</p>
      <div className="sync-actions">
        <div className="sync-status">{statusText}</div>
        <button className="primary-btn" type="button" onClick={reload}>
          🔄 רענן
        </button>
      </div>
    </header>
  );
}
