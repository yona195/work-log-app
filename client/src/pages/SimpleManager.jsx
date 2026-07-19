import { useState } from "react";
import { useData } from "../state/DataProvider.jsx";
import { activeOnly } from "../lib/entities.js";
import EditSimpleItemModal from "../components/EditSimpleItemModal.jsx";
import ActionsLegend from "../components/ActionsLegend.jsx";
import Pagination, { usePagedList } from "../components/Pagination.jsx";

export default function SimpleManager({ collection, placeholder, editTitle }) {
  const { data, addItem, updateItem, deleteItem } = useData();
  const [name, setName] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const items = data[collection] || [];
  const visibleItems = showArchived ? items : activeOnly(items);
  const {
    pageItems: pagedItems,
    page,
    setPage,
    totalPages,
    startIndex,
  } = usePagedList(visibleItems);

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

  const deleteItemConfirmed = async (item) => {
    if (
      !confirm(
        `למחוק את ${item.name} לצמיתות? בשונה מהעברה לארכיון, מחיקה תשפיע גם על דוחות והיסטוריה שכבר נרשמו עם הפריט הזה.`
      )
    ) {
      return;
    }
    await deleteItem(collection, item.id);
  };

  return (
    <>
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
                <th className="actions-column">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {pagedItems.map((item, index) => (
                <tr key={item.id}>
                  <td>{startIndex + index + 1}</td>
                  <td>{item.name}</td>
                  <td>{item.archived ? "בארכיון" : "פעיל"}</td>
                  <td>
                    <div className="report-row-actions">
                      <button
                        className="edit-btn"
                        type="button"
                        onClick={() => setEditingItem(item)}
                      >
                        ערוך
                      </button>
                      <button
                        className="delete-btn"
                        type="button"
                        onClick={() => deleteItemConfirmed(item)}
                      >
                        מחק
                      </button>
                      <button
                        className="archive-btn"
                        type="button"
                        onClick={() => toggleArchive(item)}
                      >
                        {item.archived ? "שחזר" : "ארכיון"}
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

      {editingItem && (
        <EditSimpleItemModal
          title={editTitle}
          initialName={editingItem.name}
          onSave={(newName) => updateItem(collection, editingItem.id, { name: newName })}
          onClose={() => setEditingItem(null)}
        />
      )}
    </>
  );
}
