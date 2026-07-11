import { useMemo, useState } from "react";
import { useData } from "../state/DataProvider.jsx";
import { formatCurrency, normalizeDate, todayISO } from "../lib/format.js";
import { getName, getEmployeeAffiliationName } from "../lib/entities.js";

export default function Rates() {
  const { data, addItem, deleteItem } = useData();
  const { sites, employees, subcontractors, rates } = data;

  const [selectedSiteIds, setSelectedSiteIds] = useState([]);
  const [rateType, setRateType] = useState("subcontractor");
  const [selectedTargetIds, setSelectedTargetIds] = useState([]);
  const [revenue, setRevenue] = useState("");
  const [cost, setCost] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(todayISO());

  const targets =
    rateType === "employee"
      ? employees.map((e) => ({
          id: e.id,
          label: `${e.name} — ${getEmployeeAffiliationName(data, e)}`,
        }))
      : subcontractors.map((s) => ({ id: s.id, label: s.name }));

  const toggle = (list, setList, id) =>
    setList(
      list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
    );

  const changeRateType = (value) => {
    setRateType(value);
    setSelectedTargetIds([]);
  };

  const sortedRates = useMemo(() => {
    return [...rates].sort((a, b) => {
      const siteCompare = getName(sites, a.siteId).localeCompare(
        getName(sites, b.siteId),
        "he"
      );
      if (siteCompare !== 0) return siteCompare;
      return String(a.effectiveFrom || "").localeCompare(
        String(b.effectiveFrom || "")
      );
    });
  }, [rates, sites]);

  const addRates = async () => {
    const revenuePerWorker = Number(revenue);
    const costPerWorker = Number(cost);

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

    let addedCount = 0;
    let skippedCount = 0;

    for (const siteId of selectedSiteIds) {
      for (const targetId of selectedTargetIds) {
        const duplicate = rates.some((rate) => {
          const sameBase =
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

        // eslint-disable-next-line no-await-in-loop
        await addItem("rates", {
          siteId,
          rateType,
          subcontractorId: rateType === "subcontractor" ? targetId : "",
          employeeId: rateType === "employee" ? targetId : "",
          revenuePerWorker,
          costPerWorker,
          effectiveFrom,
        });
        addedCount += 1;
      }
    }

    if (addedCount === 0) {
      alert("לא נוספו תעריפים. כל השילובים שנבחרו כבר קיימים.");
      return;
    }

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
  };

  return (
    <>
      <div className="card">
        <h3>הוספת תעריף</h3>

        <label>בחר אתרי עבודה</label>
        <div className="checkbox-list">
          {sites.length === 0 ? (
            <p className="empty-message">אין אתרי עבודה</p>
          ) : (
            sites.map((site) => (
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
            onClick={() => setSelectedSiteIds(sites.map((s) => s.id))}
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

        <label>
          {rateType === "employee" ? "בחר עובדים ספציפיים" : "בחר קבלני משנה"}
        </label>
        <div className="checkbox-list">
          {targets.length === 0 ? (
            <p className="empty-message">
              {rateType === "employee" ? "אין עובדים" : "אין קבלני משנה"}
            </p>
          ) : (
            targets.map((target) => (
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
            onClick={() => setSelectedTargetIds(targets.map((t) => t.id))}
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
        <input
          type="date"
          value={effectiveFrom}
          onChange={(e) => setEffectiveFrom(e.target.value)}
        />

        <button className="primary-btn" type="button" onClick={addRates}>
          הוסף תעריפים
        </button>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h3>תעריפים קיימים - סה״כ {rates.length}</h3>
        {sortedRates.length === 0 ? (
          <p>עדיין לא הוגדרו תעריפים.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>אתר</th>
                <th>סוג</th>
                <th>עובד / קבלן</th>
                <th>שיוך</th>
                <th>הכנסה</th>
                <th>עלות</th>
                <th>רווח</th>
                <th>בתוקף מתאריך</th>
                <th>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {sortedRates.map((rate, index) => {
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
                    <td>{index + 1}</td>
                    <td>{getName(sites, rate.siteId) || "אתר לא נמצא"}</td>
                    <td>{isEmployeeRate ? "תעריף אישי" : "תעריף כללי"}</td>
                    <td>{targetName || "לא נמצא"}</td>
                    <td>{affiliationName}</td>
                    <td>{formatCurrency(revenueValue)}</td>
                    <td>{formatCurrency(costValue)}</td>
                    <td>{formatCurrency(revenueValue - costValue)}</td>
                    <td dir="ltr">{normalizeDate(rate.effectiveFrom)}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => deleteItem("rates", rate.id)}
                      >
                        מחק
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
