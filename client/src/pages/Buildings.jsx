import { useState } from "react";
import { useData } from "../state/DataProvider.jsx";
import { getName, activeOnly } from "../lib/entities.js";

export default function Buildings() {
  const { data, addItem, updateItem } = useData();
  const { buildings, sites } = data;

  const [siteId, setSiteId] = useState("");
  const [name, setName] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const visibleBuildings = showArchived ? buildings : activeOnly(buildings);

  const add = async () => {
    if (!siteId) {
      alert("נא לבחור אתר עבודה");
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      alert("נא להזין שם מבנה");
      return;
    }
    await addItem("buildings", { siteId, name: trimmed });
    setName("");
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

        <button className="primary-btn" type="button" onClick={add}>
          הוסף מבנה
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
                <th>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {visibleBuildings.map((building, index) => (
                <tr key={building.id}>
                  <td>{index + 1}</td>
                  <td>{building.name}</td>
                  <td>{getName(sites, building.siteId)}</td>
                  <td>{building.archived ? "בארכיון" : "פעיל"}</td>
                  <td>
                    <button type="button" onClick={() => toggleArchive(building)}>
                      {building.archived ? "שחזר" : "העבר לארכיון"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
