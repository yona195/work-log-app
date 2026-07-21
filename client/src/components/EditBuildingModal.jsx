import { useMemo, useState } from "react";
import { useData } from "../state/DataProvider.jsx";
import { activeOnly } from "../lib/entities.js";

// Reserved for the auto-created default building (see Sites.jsx) — this
// modal never opens for that building itself (no edit button reaches it),
// but a *different* building must not be renamed into it either, since that
// would make it ambiguous which one is the real fallback target.
const GENERAL_BUILDING_NAME = "כללי";

export default function EditBuildingModal({ building, onClose }) {
  const { data, updateItem } = useData();
  const sites = activeOnly(data.sites);

  const [name, setName] = useState(building.name);
  const [siteId, setSiteId] = useState(building.siteId || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Keep the building's current site selectable even if it was archived
  // since this building was assigned to it.
  const siteOptions = useMemo(() => {
    if (sites.some((s) => String(s.id) === String(building.siteId))) return sites;
    const archived = (data.sites || []).find(
      (s) => String(s.id) === String(building.siteId)
    );
    return archived ? [...sites, archived] : sites;
  }, [sites, data.sites, building.siteId]);

  const save = async () => {
    if (isSubmitting) return;
    const trimmed = name.trim();
    if (!trimmed) {
      alert("נא להזין שם מבנה");
      return;
    }
    if (!siteId) {
      alert("נא לבחור אתר עבודה");
      return;
    }
    if (trimmed === GENERAL_BUILDING_NAME) {
      alert(`השם "${GENERAL_BUILDING_NAME}" שמור למבנה ברירת המחדל של האתר.`);
      return;
    }
    if (!confirm("לשמור את השינויים?")) return;

    setIsSubmitting(true);
    try {
      await updateItem("buildings", building.id, { name: trimmed, siteId });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>עריכת מבנה</h3>

        <label>אתר עבודה</label>
        <select value={siteId} onChange={(e) => setSiteId(e.target.value)}>
          <option value="">בחר אתר</option>
          {siteOptions.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
              {site.archived ? " (בארכיון)" : ""}
            </option>
          ))}
        </select>

        <label>שם מבנה</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />

        <div className="modal-actions">
          <button
            className="primary-btn"
            type="button"
            onClick={save}
            disabled={isSubmitting}
          >
            {isSubmitting ? "שומר..." : "שמור"}
          </button>
          <button className="secondary-btn" type="button" onClick={onClose}>
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
