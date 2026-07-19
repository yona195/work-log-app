import { useMemo, useState } from "react";
import { useData } from "../state/DataProvider.jsx";
import {
  activeOnly,
  activeEmployees,
  isEmployeeArchived,
  getEmployeeAffiliationName,
} from "../lib/entities.js";
import { normalizeDate } from "../lib/format.js";
import DatePicker from "./DatePicker.jsx";

export default function EditRateModal({ rate, onClose }) {
  const { data, updateItem } = useData();
  const customers = activeOnly(data.customers);
  const sites = activeOnly(data.sites);
  const employees = activeEmployees(data);

  const [customerId, setCustomerId] = useState(rate.customerId || "");
  const [siteId, setSiteId] = useState(rate.siteId || "");
  // Every rate is employee-specific now. A legacy general (subcontractor-type)
  // rate has no employeeId, so it starts unselected and picking one converts
  // it to a personal rate on save.
  const [targetId, setTargetId] = useState(rate.employeeId || "");
  const [revenue, setRevenue] = useState(String(rate.revenuePerWorker ?? ""));
  const [cost, setCost] = useState(String(rate.costPerWorker ?? ""));
  const [effectiveFrom, setEffectiveFrom] = useState(normalizeDate(rate.effectiveFrom));
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Editing a rate whose customer/site/target was archived since it was
  // recorded — keep it selectable here too, so saving doesn't silently
  // drop it, even though it no longer appears for NEW rates.
  const customerOptions = useMemo(() => {
    if (customers.some((c) => String(c.id) === String(rate.customerId))) return customers;
    const archived = (data.customers || []).find(
      (c) => String(c.id) === String(rate.customerId)
    );
    return archived ? [...customers, archived] : customers;
  }, [customers, data.customers, rate.customerId]);

  const siteOptions = useMemo(() => {
    if (sites.some((s) => String(s.id) === String(rate.siteId))) return sites;
    const archived = (data.sites || []).find((s) => String(s.id) === String(rate.siteId));
    return archived ? [...sites, archived] : sites;
  }, [sites, data.sites, rate.siteId]);

  const targetOptions = useMemo(() => {
    const ids = new Set(employees.map((e) => e.id));
    const missing = (data.employees || []).filter(
      (e) => String(e.id) === String(rate.employeeId) && !ids.has(e.id)
    );
    return [...employees, ...missing].map((e) => ({
      id: e.id,
      label: `${e.name} — ${getEmployeeAffiliationName(data, e)}`,
      archived: isEmployeeArchived(e, data.subcontractors),
    }));
  }, [employees, data, rate.employeeId]);

  const save = async () => {
    if (isSubmitting) return;

    const revenuePerWorker = Number(revenue);
    const costPerWorker = Number(cost);

    if (!customerId || !siteId || !targetId) {
      alert("נא למלא מזמין, אתר ועובד/קבלן");
      return;
    }
    if (revenue === "" || !Number.isFinite(revenuePerWorker) || revenuePerWorker < 0) {
      alert("נא להזין הכנסה תקינה");
      return;
    }
    if (cost === "" || !Number.isFinite(costPerWorker) || costPerWorker < 0) {
      alert("נא להזין עלות תקינה");
      return;
    }
    if (!effectiveFrom) {
      alert("נא לבחור תאריך תחילת תעריף");
      return;
    }
    if (!confirm("לשמור את השינויים?")) return;

    setIsSubmitting(true);
    try {
      await updateItem("rates", rate.id, {
        customerId,
        siteId,
        rateType: "employee",
        subcontractorId: "",
        employeeId: targetId,
        revenuePerWorker,
        costPerWorker,
        effectiveFrom,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>עריכת תעריף</h3>

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

        <label>עובד</label>
        <select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
          <option value="">בחר עובד</option>
          {targetOptions.map((target) => (
            <option key={target.id} value={target.id}>
              {target.label}
              {target.archived ? " (בארכיון)" : ""}
            </option>
          ))}
        </select>

        <label>הכנסה לעובד ליום</label>
        <input
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={revenue}
          onChange={(e) => setRevenue(e.target.value)}
        />

        <label>עלות לעובד ליום</label>
        <input
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
        />

        <label>תאריך תחילת תעריף</label>
        <DatePicker mode="single" value={effectiveFrom} onChange={setEffectiveFrom} />

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
