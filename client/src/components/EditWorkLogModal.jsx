import { useMemo, useState } from "react";
import { useData } from "../state/DataProvider.jsx";
import { useConfirm } from "../state/ConfirmProvider.jsx";
import { activeOnly, activeEmployees, isEmployeeArchived } from "../lib/entities.js";
import { normalizeDate } from "../lib/format.js";
import DatePicker from "./DatePicker.jsx";

export default function EditWorkLogModal({ log, onClose }) {
  const { data, updateItem } = useData();
  const confirmDialog = useConfirm();
  const employees = activeEmployees(data);
  const sites = activeOnly(data.sites);
  const buildings = activeOnly(data.buildings);
  const customers = activeOnly(data.customers);

  const [date, setDate] = useState(normalizeDate(log.date));
  const [selectedEmployees, setSelectedEmployees] = useState(log.employeeIds || []);
  const [siteId, setSiteId] = useState(log.siteId || "");
  const [selectedBuildings, setSelectedBuildings] = useState(log.buildingIds || []);
  const [customerId, setCustomerId] = useState(log.customerId || "");
  const [notes, setNotes] = useState(log.notes || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Editing a log whose employee/site/building/customer was archived since
  // it was recorded — keep it selectable here too, so saving doesn't
  // silently drop it, even though it no longer appears for NEW entries.
  const employeeOptions = useMemo(() => {
    const ids = new Set(employees.map((e) => e.id));
    const missing = (data.employees || []).filter(
      (e) => (log.employeeIds || []).includes(e.id) && !ids.has(e.id)
    );
    return [...employees, ...missing];
  }, [employees, data.employees, log.employeeIds]);

  const siteOptions = useMemo(() => {
    if (sites.some((s) => String(s.id) === String(log.siteId))) return sites;
    const archivedSite = (data.sites || []).find(
      (s) => String(s.id) === String(log.siteId)
    );
    return archivedSite ? [...sites, archivedSite] : sites;
  }, [sites, data.sites, log.siteId]);

  const buildingOptions = useMemo(() => {
    const relevant = buildings.filter((b) => String(b.siteId) === String(siteId));
    const ids = new Set(relevant.map((b) => b.id));
    const missing = (data.buildings || []).filter(
      (b) =>
        b.archived &&
        String(b.siteId) === String(siteId) &&
        (log.buildingIds || []).includes(b.id) &&
        !ids.has(b.id)
    );
    return [...relevant, ...missing];
  }, [buildings, data.buildings, siteId, log.buildingIds]);

  const customerOptions = useMemo(() => {
    if (customers.some((c) => String(c.id) === String(log.customerId))) return customers;
    const archivedCustomer = (data.customers || []).find(
      (c) => String(c.id) === String(log.customerId)
    );
    return archivedCustomer ? [...customers, archivedCustomer] : customers;
  }, [customers, data.customers, log.customerId]);

  const toggle = (list, setList, id) =>
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const changeSite = (value) => {
    setSiteId(value);
    setSelectedBuildings([]);
  };

  const save = async () => {
    if (isSubmitting) return;
    if (
      !date ||
      selectedEmployees.length === 0 ||
      !siteId ||
      selectedBuildings.length === 0 ||
      !customerId
    ) {
      alert("נא למלא תאריך, עובד, אתר, מבנה ומזמין");
      return;
    }
    if (
      !(await confirmDialog("לשמור את השינויים ברשומה?", {
        title: "לשמור שינויים?",
        confirmLabel: "שמור",
      }))
    ) {
      return;
    }

    setIsSubmitting(true);
    try {
      await updateItem("workLogs", log.id, {
        date,
        employeeIds: selectedEmployees,
        buildingIds: selectedBuildings,
        siteId,
        customerId,
        notes: notes.trim(),
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>עריכת רשומת יומן</h3>

        <label>תאריך</label>
        <DatePicker mode="single" value={date} onChange={setDate} />

        <div className="section-title-row">
          <label>עובדים</label>
        </div>
        <div className="checkbox-list">
          {employeeOptions.length === 0 ? (
            <div className="empty-message">אין עובדים זמינים</div>
          ) : (
            employeeOptions.map((employee) => (
              <label className="checkbox-item" key={employee.id}>
                <input
                  type="checkbox"
                  checked={selectedEmployees.includes(employee.id)}
                  onChange={() =>
                    toggle(selectedEmployees, setSelectedEmployees, employee.id)
                  }
                />
                <span>
                  {employee.name}
                  {isEmployeeArchived(employee, data.subcontractors)
                    ? " (בארכיון)"
                    : ""}
                </span>
              </label>
            ))
          )}
        </div>

        <label>אתר עבודה</label>
        <select value={siteId} onChange={(e) => changeSite(e.target.value)}>
          <option value="">בחר אתר</option>
          {siteOptions.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
              {site.archived ? " (בארכיון)" : ""}
            </option>
          ))}
        </select>

        <label>מבנים</label>
        <div className="checkbox-list">
          {buildingOptions.length === 0 ? (
            <div className="empty-message">אין מבנים באתר הזה</div>
          ) : (
            buildingOptions.map((building) => (
              <label className="checkbox-item" key={building.id}>
                <input
                  type="checkbox"
                  checked={selectedBuildings.includes(building.id)}
                  onChange={() =>
                    toggle(selectedBuildings, setSelectedBuildings, building.id)
                  }
                />
                <span>
                  {building.name}
                  {building.archived ? " (בארכיון)" : ""}
                </span>
              </label>
            ))
          )}
        </div>

        <label>מזמין עבודה</label>
        <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
          <option value="">בחר מזמין</option>
          {customerOptions.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
              {customer.archived ? " (בארכיון)" : ""}
            </option>
          ))}
        </select>

        <label>הערות</label>
        <textarea
          placeholder="אופציונלי"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        ></textarea>

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
