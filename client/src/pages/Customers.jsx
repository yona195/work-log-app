import { useState } from "react";
import { useData } from "../state/DataProvider.jsx";
import { activeOnly } from "../lib/entities.js";
import EditSimpleItemModal from "../components/EditSimpleItemModal.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import Pagination, { usePagedList } from "../components/Pagination.jsx";

export default function Customers() {
  const { data, addItem, updateItem, deleteItem } = useData();
  const { customers, rates, workLogs } = data;
  const [name, setName] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const visibleItems = showArchived ? customers : activeOnly(customers);
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
      await addItem("customers", { name: trimmed });
      setName("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleArchive = async (item) => {
    if (item.archived) {
      await updateItem("customers", item.id, { archived: false });
      return;
    }
    if (
      !confirm(
        `להעביר את ${item.name} לארכיון? הפריט לא יופיע יותר לבחירה ברשומות חדשות, אבל הדוחות הקיימים לא ישתנו.`
      )
    ) {
      return;
    }
    await updateItem("customers", item.id, { archived: true });
  };

  // A customer IS a billing unit (like a site) — deleting one deletes
  // everything that depends on it (rates and work-log/history records),
  // it never falls back to something else. This only fires from the
  // explicit delete action below; archiving a customer never touches
  // rates or work logs, same as archiving anywhere else in the app.
  const deleteItemConfirmed = async (item) => {
    const customerRates = rates.filter((r) => String(r.customerId || "") === String(item.id));
    const customerWorkLogs = workLogs.filter(
      (log) => String(log.customerId || "") === String(item.id)
    );

    const cascadeParts = [];
    if (customerRates.length > 0) cascadeParts.push(`${customerRates.length} תעריפים`);
    if (customerWorkLogs.length > 0) cascadeParts.push(`${customerWorkLogs.length} רשומות עבודה`);
    const cascadeNote = cascadeParts.length > 0 ? ` וכל ${cascadeParts.join(", ")}` : "";

    if (
      !confirm(
        `למחוק את ${item.name}${cascadeNote} לצמיתות? בשונה מהעברה לארכיון, מחיקה תשפיע גם על דוחות והיסטוריה שכבר נרשמו עם הפריט הזה.`
      )
    ) {
      return;
    }
    for (const log of customerWorkLogs) {
      // eslint-disable-next-line no-await-in-loop
      await deleteItem("workLogs", log.id);
    }
    for (const rate of customerRates) {
      // eslint-disable-next-line no-await-in-loop
      await deleteItem("rates", rate.id);
    }
    await deleteItem("customers", item.id);
  };

  return (
    <>
      <div className="card">
        <h3>הוספת מזמין עבודה</h3>
        <label>שם מזמין</label>
        <input
          placeholder="שם מזמין"
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
        <div className="section-title-row">
          <h3>רשימה קיימת</h3>
          <label className="checkbox-item" style={{ display: "inline-flex" }}>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            <span>הצג פריטים בארכיון</span>
          </label>
        </div>
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
                  <td><StatusBadge archived={item.archived} /></td>
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

      {editingItem && (
        <EditSimpleItemModal
          title="עריכת מזמין עבודה"
          initialName={editingItem.name}
          onSave={(newName) => updateItem("customers", editingItem.id, { name: newName })}
          onClose={() => setEditingItem(null)}
        />
      )}
    </>
  );
}
