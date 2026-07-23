import { useState } from "react";
import { useData } from "../state/DataProvider.jsx";
import { useConfirm } from "../state/ConfirmProvider.jsx";
import { useToast } from "../state/ToastProvider.jsx";
import { activeOnly } from "../lib/entities.js";
import EditSimpleItemModal from "../components/EditSimpleItemModal.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import Pagination, { usePagedList } from "../components/Pagination.jsx";
import { useBulkSelection } from "../components/useBulkSelection.js";
import { useBulkOperation } from "../components/useBulkOperation.jsx";

export default function Customers() {
  const { data, addItem, updateItem, deleteItem } = useData();
  const confirmDialog = useConfirm();
  const { showToast } = useToast();
  const { overlay: bulkOverlay, run: runBulkOperation } = useBulkOperation();
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

  const {
    selectedIds: selectedCustomerIds,
    toggle: toggleCustomerSelection,
    isFullySelected: isCustomerGroupFullySelected,
    toggleAll: toggleAllCustomers,
    clear: clearCustomerSelection,
  } = useBulkSelection(visibleItems);

  // "Select all" is scoped to the current page only, matching Rates.jsx.
  const isAllCurrentPageSelected = isCustomerGroupFullySelected(pagedItems);
  const toggleSelectAllCurrentPage = () => toggleAllCustomers(pagedItems);

  // Every delete button on this page (row/bulk) is hidden until this is
  // checked — "ארכיון"/"ערוך" stay visible either way, since only delete
  // is dangerous enough to need a second, explicit door.
  const [advancedModeEnabled, setAdvancedModeEnabled] = useState(false);

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
      !(await confirmDialog(
        `להעביר את ${item.name} לארכיון? הפריט לא יופיע יותר לבחירה ברשומות חדשות, אבל הדוחות הקיימים לא ישתנו.`
      ))
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
  const deleteCustomerCascade = async (item, options = {}) => {
    const customerRates = rates.filter((r) => String(r.customerId || "") === String(item.id));
    const customerWorkLogs = workLogs.filter(
      (log) => String(log.customerId || "") === String(item.id)
    );
    for (const log of customerWorkLogs) {
      // eslint-disable-next-line no-await-in-loop
      await deleteItem("workLogs", log.id, options);
    }
    for (const rate of customerRates) {
      // eslint-disable-next-line no-await-in-loop
      await deleteItem("rates", rate.id, options);
    }
    await deleteItem("customers", item.id, options);
  };

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
      !(await confirmDialog(
        `למחוק את ${item.name}${cascadeNote} לצמיתות? בשונה מהעברה לארכיון, מחיקה תשפיע גם על דוחות והיסטוריה שכבר נרשמו עם הפריט הזה.`,
        { danger: true }
      ))
    ) {
      return;
    }
    const total = customerRates.length + customerWorkLogs.length + 1;
    await runBulkOperation("מוחק מזמין", total, async (setProgress) => {
      await deleteCustomerCascade(item, { silent: true });
      setProgress(total);
    });
    showToast("success", `${item.name} נמחק לצמיתות בהצלחה`);
  };

  const bulkArchiveSelectedCustomers = async () => {
    if (
      !(await confirmDialog(
        `להעביר את ${selectedCustomerIds.length} המזמינים שנבחרו לארכיון? המזמינים לא יופיעו יותר לבחירה ברשומות חדשות, אבל הדוחות הקיימים לא ישתנו.`
      ))
    ) {
      return;
    }
    const total = selectedCustomerIds.length;
    await runBulkOperation("מעביר מזמינים לארכיון", total, async (setProgress) => {
      let done = 0;
      for (const id of selectedCustomerIds) {
        // eslint-disable-next-line no-await-in-loop
        await updateItem("customers", id, { archived: true }, { silent: true });
        done += 1;
        setProgress(done);
      }
    });
    clearCustomerSelection();
    showToast("success", `${total} מזמינים הועברו לארכיון בהצלחה`);
  };

  const bulkDeleteSelectedCustomers = async () => {
    const selected = customers.filter((c) => selectedCustomerIds.includes(c.id));
    if (
      !(await confirmDialog(
        `למחוק ${selected.length} מזמינים שנבחרו לצמיתות? בשונה מהעברה לארכיון, מחיקה תשפיע גם על דוחות והיסטוריה שכבר נרשמו איתם (תעריפים ורישומי עבודה).`,
        { danger: true }
      ))
    ) {
      return;
    }
    const total = selected.length;
    await runBulkOperation("מוחק מזמינים", total, async (setProgress) => {
      let done = 0;
      for (const item of selected) {
        // eslint-disable-next-line no-await-in-loop
        await deleteCustomerCascade(item, { silent: true });
        done += 1;
        setProgress(done);
      }
    });
    clearCustomerSelection();
    showToast("success", `${total} מזמינים נמחקו בהצלחה`);
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

        {visibleItems.length > 0 && (
          <div className="bulk-select-row">
            <label className="checkbox-item">
              <input
                type="checkbox"
                checked={isAllCurrentPageSelected}
                onChange={toggleSelectAllCurrentPage}
              />
              <span>בחר הכל</span>
            </label>
            <label className="checkbox-item">
              <input
                type="checkbox"
                checked={advancedModeEnabled}
                onChange={(e) => setAdvancedModeEnabled(e.target.checked)}
              />
              <span>מצב מתקדם</span>
            </label>
            {selectedCustomerIds.length > 0 && (
              <div className="report-row-actions bulk-actions-inline">
                <button className="archive-btn" type="button" onClick={bulkArchiveSelectedCustomers}>
                  ארכיון ({selectedCustomerIds.length})
                </button>
                {advancedModeEnabled && (
                  <button className="delete-btn" type="button" onClick={bulkDeleteSelectedCustomers}>
                    מחק ({selectedCustomerIds.length})
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {visibleItems.length === 0 ? (
          <p>אין עדיין נתונים</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th className="select-column" aria-hidden="true" />
                <th>#</th>
                <th>שם</th>
                <th>סטטוס</th>
                <th className="actions-column">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {pagedItems.map((item, index) => (
                <tr key={item.id}>
                  <td className="select-column">
                    <input
                      type="checkbox"
                      checked={selectedCustomerIds.includes(item.id)}
                      onChange={() => toggleCustomerSelection(item.id)}
                    />
                  </td>
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
                      {advancedModeEnabled && (
                        <button
                          className="delete-btn"
                          type="button"
                          onClick={() => deleteItemConfirmed(item)}
                        >
                          מחק
                        </button>
                      )}
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

      {bulkOverlay}
    </>
  );
}
