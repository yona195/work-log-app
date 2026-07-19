import { useState } from "react";
import { useData } from "../state/DataProvider.jsx";
import { activeOnly } from "../lib/entities.js";
import SettingsHelpCard from "../components/SettingsHelpCard.jsx";

export default function SimpleManager({ collection, placeholder, helpTitle, helpItems }) {
  const { data, addItem, updateItem } = useData();
  const [name, setName] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const items = data[collection] || [];
  const visibleItems = showArchived ? items : activeOnly(items);

  const add = async () => {
    if (isSubmitting) return;
    const trimmed = name.trim();
    if (!trimmed) {
      alert("נא להזין שם");
      return;
    }
    setIsSubmitting(true);
    try {
      await addItem(collection, { name: trimmed });
      setName("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleArchive = async (item) => {
    if (item.archived) {
      await updateItem(collection, item.id, { archived: false });
      return;
    }
    if (
      !confirm(
        `להעביר את ${item.name} לארכיון? הפריט לא יופיע יותר לבחירה ברשומות חדשות, אבל הדוחות הקיימים לא ישתנו.`
      )
    ) {
      return;
    }
    await updateItem(collection, item.id, { archived: true });
  };

  return (
    <>
      {helpItems && <SettingsHelpCard title={helpTitle} items={helpItems} />}

      <div className="card">
        <h3>הוספה</h3>
        <input
          placeholder={placeholder}
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
          {isSubmitting ? "מוסיף..." : "הוסף"}
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
        <h3>רשימה קיימת</h3>
        {visibleItems.length === 0 ? (
          <p>אין עדיין נתונים</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>שם</th>
                <th>סטטוס</th>
                <th>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item, index) => (
                <tr key={item.id}>
                  <td>{index + 1}</td>
                  <td>{item.name}</td>
                  <td>{item.archived ? "בארכיון" : "פעיל"}</td>
                  <td>
                    <button type="button" onClick={() => toggleArchive(item)}>
                      {item.archived ? "שחזר" : "העבר לארכיון"}
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
