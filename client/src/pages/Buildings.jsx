import { useState } from "react";
import { useData } from "../state/DataProvider.jsx";
import { getName } from "../lib/entities.js";

export default function Buildings() {
  const { data, addItem, deleteItem } = useData();
  const { buildings, sites } = data;

  const [siteId, setSiteId] = useState("");
  const [name, setName] = useState("");

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

  return (
    <>
      <div className="card">
        <h3>הוספת מבנה</h3>

        <label>אתר עבודה</label>
        <select value={siteId} onChange={(e) => setSiteId(e.target.value)}>
          <option value="">בחר אתר</option>
          {sites.map((site) => (
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
        <h3>מבנים קיימים</h3>
        {buildings.length === 0 ? (
          <p>אין עדיין מבנים</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>שם מבנה</th>
                <th>אתר</th>
                <th>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {buildings.map((building, index) => (
                <tr key={building.id}>
                  <td>{index + 1}</td>
                  <td>{building.name}</td>
                  <td>{getName(sites, building.siteId)}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => deleteItem("buildings", building.id)}
                    >
                      מחק
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
