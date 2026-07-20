import { useState } from "react";
import { useData } from "../state/DataProvider.jsx";
import { getName, activeOnly } from "../lib/entities.js";
import EditBuildingModal from "../components/EditBuildingModal.jsx";
import ActionsLegend from "../components/ActionsLegend.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import Pagination, { usePagedList } from "../components/Pagination.jsx";

export default function Buildings() {
  const { data, addItem, updateItem, deleteItem } = useData();
  const { buildings, sites } = data;

  const [siteId, setSiteId] = useState("");
  const [name, setName] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState(null);

  const visibleBuildings = showArchived ? buildings : activeOnly(buildings);
  const {
    pageItems: pagedBuildings,
    page,
    setPage,
    totalPages,
    startIndex,
  } = usePagedList(visibleBuildings);

  const add = async () => {
    if (isSubmitting) return;
    if (!siteId) {
      alert("נא לבחור אתר עבודה");
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      alert("נא להזין שם מבנה");
      return;
    }
    setIsSubmitting(true);
    try {
      await addItem("buildings", { siteId, name: trimmed });
      setName("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleArchive = async (building) => {
    if (building.archived) {
      await updateItem("buildings", building.id, { archived: false });
      return;
    }
    if (
      !confirm(
        `להעביר את ${building.name} לארכיון? המבנה לא יופיע יותר לבחירה ברשומות חדשות, אבל הדוחות הקיימים לא ישתנו.`
      )
    ) {
      return;
    }
    await updateItem("buildings", building.id, { archived: true });
  };

  const deleteBuilding = async (building) => {
    if (
      !confirm(
        `למחוק את ${building.name} לצמיתות? בשונה מהעברה לארכיון, מחיקה תשפיע גם על דוחות והיסטוריה שכבר נרשמו עם המבנה הזה.`
      )
    ) {
      return;
    }
    await deleteItem("buildings", building.id);
  };

  return (
    <>
      <div className="card">
        <h3>הוספת מבנה</h3>

        <label>אתר עבודה</label>
        <select value={siteId} onChange={(e) => setSiteId(e.target.value)}>
          <option value="">בחר אתר</option>
          {activeOnly(sites).map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </select>

        <label>שם מבנה</label>
        <input
          placeholder="שם מבנה"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />

        <button
          className="primary-btn"
          type="button"
          onClick={add}
          disabled={isSubmitting}
        >
          {isSubmitting ? "מוסיף..." : "הוסף מבנה"}
        </button>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <label className="checkbox-item" style={{ display: "inline-flex" }}>
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          <span>הצג פריטים בארכיון</span>
        </label>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h3>מבנים קיימים</h3>
        {visibleBuildings.length === 0 ? (
          <p>אין עדיין מבנים</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>שם מבנה</th>
                <th>אתר</th>
                <th>סטטוס</th>
                <th className="actions-column">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {pagedBuildings.map((building, index) => (
                <tr key={building.id}>
                  <td>{startIndex + index + 1}</td>
                  <td>{building.name}</td>
                  <td>{getName(sites, building.siteId)}</td>
                  <td><StatusBadge archived={building.archived} /></td>
                  <td>
                    <div className="report-row-actions">
                      <button
                        className="edit-btn"
                        type="button"
                        onClick={() => setEditingBuilding(building)}
                      >
                        ערוך
                      </button>
                      <button
                        className="delete-btn"
                        type="button"
                        onClick={() => deleteBuilding(building)}
                      >
                        מחק
                      </button>
                      <button
                        className="archive-btn"
                        type="button"
                        onClick={() => toggleArchive(building)}
                      >
                        {building.archived ? "שחזר" : "ארכיון"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </div>

      <ActionsLegend />

      {editingBuilding && (
        <EditBuildingModal
          building={editingBuilding}
          onClose={() => setEditingBuilding(null)}
        />
      )}
    </>
  );
}
