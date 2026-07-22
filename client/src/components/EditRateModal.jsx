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

// rates: one or more rates being edited together. A single rate behaves
// exactly as before (target/employee picker included, since that's the one
// field a single rate actually has to itself). 2+ rates are already
// guaranteed identical in customer/site/revenue/cost by the caller (they're
// a group precisely because of that) — the target picker is hidden (each
// rate keeps its own employee/subcontractor) and saving applies the shared
// fields to every rate in the group. Effective-from is NOT one of those
// shared fields (a group can contain rates with different dates), so it's
// hidden in group edit too and never included in the group patch — each
// rate keeps its own date.
export default function EditRateModal({ rates, onClose }) {
  const { data, updateItem } = useData();
  const customers = activeOnly(data.customers);
  const sites = activeOnly(data.sites);
  const employees = activeEmployees(data);

  const isGroupEdit = rates.length > 1;
  const firstRate = rates[0];

  const [customerId, setCustomerId] = useState(firstRate.customerId || "");
  const [siteId, setSiteId] = useState(firstRate.siteId || "");
  // Every rate is employee-specific now. A legacy general (subcontractor-type)
  // rate has no employeeId, so it starts unselected and picking one converts
  // it to a personal rate on save. Not applicable in group edit (hidden).
  const [targetId, setTargetId] = useState(isGroupEdit ? "" : firstRate.employeeId || "");
  const [revenue, setRevenue] = useState(String(firstRate.revenuePerWorker ?? ""));
  const [cost, setCost] = useState(String(firstRate.costPerWorker ?? ""));
  const [effectiveFrom, setEffectiveFrom] = useState(normalizeDate(firstRate.effectiveFrom));
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Editing a rate whose customer/site/target was archived since it was
  // recorded — keep it selectable here too, so saving doesn't silently
  // drop it, even though it no longer appears for NEW rates.
  const customerOptions = useMemo(() => {
    if (customers.some((c) => String(c.id) === String(firstRate.customerId))) return customers;
    const archived = (data.customers || []).find(
      (c) => String(c.id) === String(firstRate.customerId)
    );
    return archived ? [...customers, archived] : customers;
  }, [customers, data.customers, firstRate.customerId]);

  const siteOptions = useMemo(() => {
    if (sites.some((s) => String(s.id) === String(firstRate.siteId))) return sites;
    const archived = (data.sites || []).find((s) => String(s.id) === String(firstRate.siteId));
    return archived ? [...sites, archived] : sites;
  }, [sites, data.sites, firstRate.siteId]);

  const targetOptions = useMemo(() => {
    const ids = new Set(employees.map((e) => e.id));
    const missing = (data.employees || []).filter(
      (e) => String(e.id) === String(firstRate.employeeId) && !ids.has(e.id)
    );
    return [...employees, ...missing].map((e) => ({
      id: e.id,
      label: `${e.name} — ${getEmployeeAffiliationName(data, e)}`,
      archived: isEmployeeArchived(e, data.subcontractors),
    }));
  }, [employees, data, firstRate.employeeId]);

  const save = async () => {
    if (isSubmitting) return;

    const revenuePerWorker = Number(revenue);
    const costPerWorker = Number(cost);

    if (!customerId || !siteId || (!isGroupEdit && !targetId)) {
      alert(isGroupEdit ? "נא למלא מזמין ואתר" : "נא למלא מזמין, אתר ועובד/קבלן");
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
    if (!isGroupEdit && !effectiveFrom) {
      alert("נא לבחור תאריך תחילת תעריף");
      return;
    }
    if (
      !confirm(
        isGroupEdit ? `לשמור את השינויים עבור כל ${rates.length} התעריפים בקבוצה?` : "לשמור את השינויים?"
      )
    )
      return;

    setIsSubmitting(true);
    try {
      if (isGroupEdit) {
        // effectiveFrom is deliberately excluded — a group can contain rates
        // with different dates, so a group edit must not collapse them all
        // to whichever date happened to seed the (hidden) form field.
        const patch = { customerId, siteId, revenuePerWorker, costPerWorker };
        for (const rate of rates) {
          // eslint-disable-next-line no-await-in-loop
          await updateItem("rates", rate.id, patch);
        }
      } else {
        await updateItem("rates", firstRate.id, {
          customerId,
          siteId,
          rateType: "employee",
          subcontractorId: "",
          employeeId: targetId,
          revenuePerWorker,
          costPerWorker,
          effectiveFrom,
        });
      }
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>{isGroupEdit ? `עריכת קבוצת תעריפים (${rates.length})` : "עריכת תעריף"}</h3>

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

        {!isGroupEdit && (
          <>
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
          </>
        )}

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

        {!isGroupEdit && (
          <>
            <label>תאריך תחילת תעריף</label>
            <DatePicker mode="single" value={effectiveFrom} onChange={setEffectiveFrom} />
          </>
        )}

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
