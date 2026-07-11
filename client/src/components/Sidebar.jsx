import { NavLink } from "react-router-dom";
import { NAV_SECTIONS } from "../nav.js";
import { useAuth } from "../state/AuthProvider.jsx";

export default function Sidebar({ open, onNavigate }) {
  const { authRequired, logout } = useAuth();

  return (
    <aside className={`sidebar${open ? " open" : ""}`}>
      <div className="sidebar-logo">יומן עבודה</div>

      {NAV_SECTIONS.map((section, index) => (
        <div key={section.title}>
          {index > 0 && <div className="sidebar-divider"></div>}
          <div className="sidebar-section">
            <div className="sidebar-section-title">{section.title}</div>
            {section.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/"}
                className={({ isActive }) =>
                  `nav-btn${isActive ? " active" : ""}`
                }
                onClick={onNavigate}
              >
                <span className="material-symbols-rounded nav-icon">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      ))}

      {authRequired && (
        <div style={{ marginTop: "auto" }}>
          <div className="sidebar-divider"></div>
          <div className="sidebar-section">
            <button type="button" className="nav-btn" onClick={logout}>
              <span className="material-symbols-rounded nav-icon">logout</span>
              <span>התנתקות</span>
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
