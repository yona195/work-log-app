import { useMemo, useState } from "react";
import { useData } from "../state/DataProvider.jsx";
import { activeOnly } from "../lib/entities.js";

// rates: every rate in one group (customer+site+revenue+cost) — a group of
// one is edited with the exact same form as a group of many. There is no
// per-employee field here on purpose: a previous version let this modal
// reassign a single rate's employee, which could silently create a second,
// duplicate rate for that employee at the same customer/site (an employee
// can only be reassigned by adding a new rate from scratch, not by editing
// an existing one). Effective-from is likewise excluded from the shared
// patch — a group can contain rates with different dates, each kept as-is.
export default function EditRateModal({ rates, onClose }) {
  const { data, updateItem } = useData();
  const customers = activeOnly(data.customers);
  const sites = activeOnly(data.sites);

  const firstRate = rates[0];

  const [customerId, setCustomerId] = useState(firstRate.customerId || "");
  const [siteId, setSiteId] = useState(firstRate.siteId || "");
  const [revenue, setRevenue] = useState(String(firstRate.revenuePerWorker ?? ""));
  const [cost, setCost] = useState(String(firstRate.costPerWorker ?? ""));
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Editing a rate whose customer/site was archived since it was recorded
  // — keep it selectable here too, so saving doesn't silently drop it,
  // even though it no longer appears for NEW rates.
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

  const save = async () => {
    if (isSubmitting) return;

    const revenuePerWorker = Number(revenue);
    const costPerWorker = Number(cost);

    if (!customerId || !siteId) {
      alert("נא למלא מזמין ואתר");
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

    // If these changes make the group identical (customer+site+revenue+
    // cost) to some OTHER existing group, that's only safe when the two
    // groups have no employee in common — otherwise an employee would end
    // up with two rates at the same customer/site/pay, and there's no
    // single obviously-correct way to resolve that automatically (unlike
    // the run-length consolidation used for a single employee's own
    // history), so it's blocked here rather than silently merged.
    const currentRateIds = new Set(rates.map((r) => r.id));
    const employeeIdsInThisGroup = new Set(
      rates.filter((r) => r.rateType === "employee" && r.employeeId).map((r) => String(r.employeeId))
    );
    const targetGroupRates = (data.rates || []).filter(
      (r) =>
        !currentRateIds.has(r.id) &&
        r.rateType === "employee" &&
        String(r.customerId || "") === String(customerId) &&
        String(r.siteId || "") === String(siteId) &&
        Number(r.revenuePerWorker) === revenuePerWorker &&
        Number(r.costPerWorker) === costPerWorker
    );
    const overlappingEmployeeIds = [
      ...new Set(
        targetGroupRates
          .map((r) => String(r.employeeId))
          .filter((id) => employeeIdsInThisGroup.has(id))
      ),
    ];
    if (overlappingEmployeeIds.length > 0) {
      const names = overlappingEmployeeIds.map((id) => {
        const employee = (data.employees || []).find((e) => String(e.id) === id);
        return employee ? employee.name : id;
      });
      alert(
        `לא ניתן לשמור - העובד/ים ${names.join(", ")} כבר קיימים בקבוצה אחרת עם אותו מזמין/אתר/שכר. יש להשאיר את אחת הקבוצות עם ערך שונה.`
      );
      return;
    }

    if (!confirm(`לשמור את השינויים עבור כל ${rates.length} התעריפים בקבוצה?`)) return;

    setIsSubmitting(true);
    try {
      const patch = { customerId, siteId, revenuePerWorker, costPerWorker };
      for (const rate of rates) {
        // eslint-disable-next-line no-await-in-loop
        await updateItem("rates", rate.id, patch);
      }
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>{rates.length > 1 ? `עריכת קבוצת תעריפים (${rates.length})` : "עריכת תעריף"}</h3>

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
