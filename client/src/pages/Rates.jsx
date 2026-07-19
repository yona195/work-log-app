import { useMemo, useState } from "react";
import { useData } from "../state/DataProvider.jsx";
import { formatCurrency, normalizeDate, formatExcelDate } from "../lib/format.js";
import { todayISO } from "../lib/calendar.js";
import {
  getName,
  getEmployeeAffiliationName,
  activeOnly,
  activeEmployees,
} from "../lib/entities.js";
import EditRateModal from "../components/EditRateModal.jsx";
import ActionsLegend from "../components/ActionsLegend.jsx";
import DatePicker from "../components/DatePicker.jsx";
import Pagination, { usePagedList } from "../components/Pagination.jsx";

export default function Rates() {
  const { data, addItem, updateItem, deleteItem } = useData();
  const { sites, employees, subcontractors, customers, rates } = data;

  const [selectedCustomerIds, setSelectedCustomerIds] = useState([]);
  const [selectedSiteIds, setSelectedSiteIds] = useState([]);
  const [rateType, setRateType] = useState("subcontractor");
  const [selectedTargetIds, setSelectedTargetIds] = useState([]);
  const [revenue, setRevenue] = useState("");
  const [cost, setCost] = useState("");
  const [editingRate, setEditingRate] = useState(null);
  const [effectiveFrom, setEffectiveFrom] = useState(todayISO());
  const [showArchived, setShowArchived] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Narrows the (potentially long) employee list for a personal rate: pick
  // "עובד שלי" or a specific contractor first, then only that group's
  // employees show up to select from — instead of one flat list mixing
  // everyone together.
  const [employeeGroup, setEmployeeGroup] = useState(""); // "" | "internal" | "subcontractor"
  const [employeeSubcontractorId, setEmployeeSubcontractorId] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");

  const activeCustomers = activeOnly(customers);
  const activeSites = activeOnly(sites);

  const subcontractorTargets = activeOnly(subcontractors).map((s) => ({
    id: s.id,
    label: s.name,
  }));

  const employeeTargets = useMemo(() => {
    if (rateType !== "employee" || !employeeGroup) return [];
    let list = activeEmployees(data);
    if (employeeGroup === "internal") {
      list = list.filter((e) => e.type === "internal");
    } else {
      if (!employeeSubcontractorId) return [];
      list = list.filter(
        (e) =>
          (e.type === "subcontractor" || e.type === "external") &&
          String(e.subcontractorId || "") === String(employeeSubcontractorId)
      );
    }
    const text = employeeSearch.trim().toLowerCase();
    if (text) list = list.filter((e) => e.name.toLowerCase().includes(text));
    return list.map((e) => ({ id: e.id, label: e.name }));
  }, [rateType, employeeGroup, employeeSubcontractorId, employeeSearch, data]);

  const toggle = (list, setList, id) =>
    setList(
      list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
    );

  const changeRateType = (value) => {
    setRateType(value);
    setSelectedTargetIds([]);
    setEmployeeGroup("");
    setEmployeeSubcontractorId("");
    setEmployeeSearch("");
  };

  const changeEmployeeGroup = (value) => {
    setEmployeeGroup(value);
    setEmployeeSubcontractorId("");
    setSelectedTargetIds([]);
    setEmployeeSearch("");
  };

  const changeEmployeeSubcontractor = (value) => {
    setEmployeeSubcontractorId(value);
    setSelectedTargetIds([]);
  };

  const sortedRates = useMemo(() => {
    const visible = showArchived ? rates : activeOnly(rates);
    return [...visible].sort((a, b) => {
      const siteCompare = getName(sites, a.siteId).localeCompare(
        getName(sites, b.siteId),
        "he"
      );
      if (siteCompare !== 0) return siteCompare;
      return String(a.effectiveFrom || "").localeCompare(
        String(b.effectiveFrom || "")
      );
    });
  }, [rates, sites, showArchived]);

  const {
    pageItems: pagedRates,
    page: ratesPage,
    setPage: setRatesPage,
    totalPages: ratesTotalPages,
    startIndex: ratesStartIndex,
  } = usePagedList(sortedRates);

  const toggleRateArchive = async (rate) => {
    if (rate.archived) {
      await updateItem("rates", rate.id, { archived: false });
      return;
    }
    if (
      !confirm(
        "להעביר את התעריף לארכיון? התעריף לא יופיע יותר לבחירה, אבל הדוחות הקיימים לא ישתנו."
      )
    ) {
      return;
    }
    await updateItem("rates", rate.id, { archived: true });
  };

  const deleteRate = async (rate) => {
    if (
      !confirm(
        "למחוק את התעריף לצמיתות? בשונה מהעברה לארכיון, מחיקה תשפיע גם על חישובים כספיים היסטוריים שכבר השתמשו בתעריף הזה."
      )
    ) {
      return;
    }
    await deleteItem("rates", rate.id);
  };

  const addRates = async () => {
    if (isSubmitting) return;

    const revenuePerWorker = Number(revenue);
    const costPerWorker = Number(cost);

    if (selectedCustomerIds.length === 0) {
      alert("נא לבחור לפחות מזמין עבודה אחד");
      return;
    }
    if (selectedSiteIds.length === 0) {
      alert("נא לבחור לפחות אתר עבודה אחד");
      return;
    }
    if (rateType !== "employee" && rateType !== "subcontractor") {
      alert("נא לבחור סוג תעריף");
      return;
    }
    if (selectedTargetIds.length === 0) {
      alert(
        rateType === "employee"
          ? "נא לבחור לפחות עובד אחד"
          : "נא לבחור לפחות קבלן משנה אחד"
      );
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

    setIsSubmitting(true);
    try {
      let addedCount = 0;
      let skippedCount = 0;

      // Archived rates are old history, not something a new rate should be
      // treated as a duplicate of — otherwise a rate that happens to share
      // a date/site/customer with something archived gets silently skipped
      // and the user sees nothing added, with no error.
      const activeRates = activeOnly(rates);

      for (const customerId of selectedCustomerIds) {
        for (const siteId of selectedSiteIds) {
          for (const targetId of selectedTargetIds) {
            const duplicate = activeRates.some((rate) => {
              const sameBase =
                String(rate.customerId || "") === String(customerId) &&
                String(rate.siteId) === String(siteId) &&
                String(rate.rateType) === String(rateType) &&
                normalizeDate(rate.effectiveFrom) === effectiveFrom;
              if (!sameBase) return false;
              return rateType === "employee"
                ? String(rate.employeeId || "") === String(targetId)
                : String(rate.subcontractorId || "") === String(targetId);
            });

            if (duplicate) {
              skippedCount += 1;
              continue;
            }

            try {
              // eslint-disable-next-line no-await-in-loop
              await addItem("rates", {
                customerId,
                siteId,
                rateType,
                subcontractorId: rateType === "subcontractor" ? targetId : "",
                employeeId: rateType === "employee" ? targetId : "",
                revenuePerWorker,
                costPerWorker,
                effectiveFrom,
              });
              addedCount += 1;
            } catch (err) {
              alert(`שגיאה בהוספת תעריף: ${err.message || "שגיאה לא ידועה"}`);
              return;
            }
          }
        }
      }

      if (addedCount === 0) {
        alert("לא נוספו תעריפים. כל השילובים שנבחרו כבר קיימים כתעריפים פעילים.");
        return;
      }

      setSelectedCustomerIds([]);
      setSelectedSiteIds([]);
      setSelectedTargetIds([]);
      setRevenue("");
      setCost("");

      if (skippedCount > 0) {
        alert(
          `נוספו ${addedCount} תעריפים. ${skippedCount} שילובים כבר היו קיימים ולא נוספו שוב.`
        );
      } else {
        alert(`נוספו בהצלחה ${addedCount} תעריפים.`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="card">
        <h3>הוספת תעריף</h3>

        <label>בחר מזמיני עבודה</label>
        <div className="checkbox-list">
          {activeCustomers.length === 0 ? (
            <p className="empty-message">אין מזמיני עבודה</p>
          ) : (
            activeCustomers.map((customer) => (
              <label className="checkbox-item" key={customer.id}>
                <input
                  type="checkbox"
                  checked={selectedCustomerIds.includes(customer.id)}
                  onChange={() =>
                    toggle(selectedCustomerIds, setSelectedCustomerIds, customer.id)
                  }
                />
                <span>{customer.name}</span>
              </label>
            ))
          )}
        </div>
        <div className="employee-actions">
          <button
            type="button"
            className="secondary-btn"
            onClick={() => setSelectedCustomerIds(activeCustomers.map((c) => c.id))}
          >
            בחר את כל המזמינים
          </button>
          <button
            type="button"
            className="secondary-btn"
            onClick={() => setSelectedCustomerIds([])}
          >
            נקה את כל המזמינים
          </button>
        </div>

        <label>בחר אתרי עבודה</label>
        <div className="checkbox-list">
          {activeSites.length === 0 ? (
            <p className="empty-message">אין אתרי עבודה</p>
          ) : (
            activeSites.map((site) => (
              <label className="checkbox-item" key={site.id}>
                <input
                  type="checkbox"
                  checked={selectedSiteIds.includes(site.id)}
                  onChange={() =>
                    toggle(selectedSiteIds, setSelectedSiteIds, site.id)
                  }
                />
                <span>{site.name}</span>
              </label>
            ))
          )}
        </div>
        <div className="employee-actions">
          <button
            type="button"
            className="secondary-btn"
            onClick={() => setSelectedSiteIds(activeSites.map((s) => s.id))}
          >
            בחר את כל האתרים
          </button>
          <button
            type="button"
            className="secondary-btn"
            onClick={() => setSelectedSiteIds([])}
          >
            נקה את כל האתרים
          </button>
        </div>

        <label>סוג תעריף</label>
        <select value={rateType} onChange={(e) => changeRateType(e.target.value)}>
          <option value="subcontractor">קבלן משנה</option>
          <option value="employee">עובד ספציפי</option>
        </select>

        {rateType === "subcontractor" ? (
          <>
            <label>בחר קבלני משנה</label>
            <div className="checkbox-list">
              {subcontractorTargets.length === 0 ? (
                <p className="empty-message">אין קבלני משנה</p>
              ) : (
                subcontractorTargets.map((target) => (
                  <label className="checkbox-item" key={target.id}>
                    <input
                      type="checkbox"
                      checked={selectedTargetIds.includes(target.id)}
                      onChange={() =>
                        toggle(selectedTargetIds, setSelectedTargetIds, target.id)
                      }
                    />
                    <span>{target.label}</span>
                  </label>
                ))
              )}
            </div>
            <div className="employee-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() =>
                  setSelectedTargetIds(subcontractorTargets.map((t) => t.id))
                }
              >
                בחר הכל
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setSelectedTargetIds([])}
              >
                נקה הכל
              </button>
            </div>
          </>
        ) : (
          <>
            <label>שיוך עובדים</label>
            <select
              value={employeeGroup}
              onChange={(e) => changeEmployeeGroup(e.target.value)}
            >
              <option value="">בחר שיוך</option>
              <option value="internal">עובד שלי</option>
              <option value="subcontractor">עובדי קבלן</option>
            </select>

            {employeeGroup === "subcontractor" && (
              <>
                <label>קבלן משנה</label>
                <select
                  value={employeeSubcontractorId}
                  onChange={(e) => changeEmployeeSubcontractor(e.target.value)}
                >
                  <option value="">בחר קבלן משנה</option>
                  {subcontractorTargets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </>
            )}

            {employeeGroup &&
              (employeeGroup === "internal" || employeeSubcontractorId) && (
                <>
                  <label>בחר עובדים</label>
                  <input
                    type="text"
                    placeholder="🔍 חפש עובד..."
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                  />
                  <div className="checkbox-list">
                    {employeeTargets.length === 0 ? (
                      <p className="empty-message">אין עובדים תואמים</p>
                    ) : (
                      employeeTargets.map((target) => (
                        <label className="checkbox-item" key={target.id}>
                          <input
                            type="checkbox"
                            checked={selectedTargetIds.includes(target.id)}
                            onChange={() =>
                              toggle(selectedTargetIds, setSelectedTargetIds, target.id)
                            }
                          />
                          <span>{target.label}</span>
                        </label>
                      ))
                    )}
                  </div>
                  <div className="employee-actions">
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() =>
                        setSelectedTargetIds(employeeTargets.map((t) => t.id))
                      }
                    >
                      בחר הכל
                    </button>
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => setSelectedTargetIds([])}
                    >
                      נקה הכל
                    </button>
                  </div>
                </>
              )}
          </>
        )}

        <label>הכנסה לעובד ליום</label>
        <input
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          placeholder="כמה אתה מקבל עבור העובד"
          value={revenue}
          onChange={(e) => setRevenue(e.target.value)}
        />

        <label>עלות לעובד ליום</label>
        <input
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          placeholder="כמה העובד או הקבלן עולה לך"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
        />

        <label>תאריך תחילת התעריף</label>
        <DatePicker mode="single" value={effectiveFrom} onChange={setEffectiveFrom} />

        <button
          className="primary-btn"
          type="button"
          onClick={addRates}
          disabled={isSubmitting}
        >
          {isSubmitting ? "מוסיף..." : "הוסף תעריפים"}
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
        <h3>תעריפים קיימים - סה״כ {activeOnly(rates).length}</h3>
        {sortedRates.length === 0 ? (
          <p>עדיין לא הוגדרו תעריפים.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>מזמין עבודה</th>
                <th>אתר</th>
                <th>סוג</th>
                <th>עובד / קבלן</th>
                <th>שיוך</th>
                <th>הכנסה</th>
                <th>עלות</th>
                <th>רווח</th>
                <th>בתוקף מתאריך</th>
                <th>סטטוס</th>
                <th className="actions-column">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {pagedRates.map((rate, index) => {
                const revenueValue = Number(rate.revenuePerWorker) || 0;
                const costValue = Number(rate.costPerWorker) || 0;
                const isEmployeeRate = rate.rateType === "employee";
                const employee = isEmployeeRate
                  ? employees.find(
                      (e) => String(e.id) === String(rate.employeeId)
                    )
                  : null;
                const targetName = isEmployeeRate
                  ? employee?.name || ""
                  : getName(subcontractors, rate.subcontractorId);
                const affiliationName =
                  isEmployeeRate && employee
                    ? getEmployeeAffiliationName(data, employee)
                    : "קבלן משנה";

                return (
                  <tr key={rate.id}>
                    <td>{ratesStartIndex + index + 1}</td>
                    <td>{getName(customers, rate.customerId) || "מזמין לא נמצא"}</td>
                    <td>{getName(sites, rate.siteId) || "אתר לא נמצא"}</td>
                    <td>{isEmployeeRate ? "תעריף אישי" : "תעריף כללי"}</td>
                    <td>{targetName || "לא נמצא"}</td>
                    <td>{affiliationName}</td>
                    <td>{formatCurrency(revenueValue)}</td>
                    <td>{formatCurrency(costValue)}</td>
                    <td>{formatCurrency(revenueValue - costValue)}</td>
                    <td dir="ltr">{formatExcelDate(rate.effectiveFrom)}</td>
                    <td>{rate.archived ? "בארכיון" : "פעיל"}</td>
                    <td>
                      <div className="report-row-actions">
                        <button
                          className="edit-btn"
                          type="button"
                          onClick={() => setEditingRate(rate)}
                        >
                          ערוך
                        </button>
                        <button
                          className="delete-btn"
                          type="button"
                          onClick={() => deleteRate(rate)}
                        >
                          מחק
                        </button>
                        <button
                          className="archive-btn"
                          type="button"
                          onClick={() => toggleRateArchive(rate)}
                        >
                          {rate.archived ? "שחזר" : "ארכיון"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <Pagination page={ratesPage} totalPages={ratesTotalPages} onChange={setRatesPage} />
      </div>

      <ActionsLegend />

      {editingRate && (
        <EditRateModal rate={editingRate} onClose={() => setEditingRate(null)} />
      )}
    </>
  );
}
