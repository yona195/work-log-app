import { useEffect, useMemo, useState } from "react";
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
import DatePicker from "../components/DatePicker.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import SelectionPanel from "../components/SelectionPanel.jsx";
import { usePagedList, ListPagination } from "../components/Pagination.jsx";

export default function Rates() {
  const { data, addItem, updateItem, deleteItem } = useData();
  const { sites, employees, subcontractors, customers, rates } = data;

  const [selectedCustomerIds, setSelectedCustomerIds] = useState([]);
  const [selectedSiteIds, setSelectedSiteIds] = useState([]);
  const [selectedTargetIds, setSelectedTargetIds] = useState([]);
  const [revenue, setRevenue] = useState("");
  const [cost, setCost] = useState("");
  const [editingRate, setEditingRate] = useState(null);
  const [effectiveFrom, setEffectiveFrom] = useState(todayISO());
  const [showArchived, setShowArchived] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedRateIds, setSelectedRateIds] = useState([]);

  // "Employee source": every rate created here is a personal (per-employee)
  // rate — pick "העובדים שלי" or one or more contractors, then only that
  // group's employees show up to select from. Choosing several contractors
  // accumulates their employees into one combined pool rather than
  // replacing it.
  const [employeeSource, setEmployeeSource] = useState("internal"); // "internal" | "subcontractor"
  const [selectedContractorIds, setSelectedContractorIds] = useState([]);
  const [contractorSearch, setContractorSearch] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");

  const activeCustomers = activeOnly(customers);
  const activeSites = activeOnly(sites);
  const activeSubcontractors = activeOnly(subcontractors);

  // Everyone who belongs to any currently-checked contractor — independent
  // of the free-text search, so typing in the search box never affects who
  // "counts" as part of the accumulated selection (only what's shown).
  const contractorEmployeeIds = useMemo(() => {
    return new Set(
      activeEmployees(data)
        .filter(
          (e) =>
            (e.type === "subcontractor" || e.type === "external") &&
            selectedContractorIds.map(String).includes(String(e.subcontractorId || ""))
        )
        .map((e) => e.id)
    );
  }, [data, selectedContractorIds]);

  const employeeTargets = useMemo(() => {
    let list = activeEmployees(data);
    list =
      employeeSource === "internal"
        ? list.filter((e) => e.type === "internal")
        : list.filter((e) => contractorEmployeeIds.has(e.id));
    const text = employeeSearch.trim().toLowerCase();
    if (text) list = list.filter((e) => e.name.toLowerCase().includes(text));
    return list.map((e) => ({ id: e.id, label: e.name }));
  }, [employeeSource, contractorEmployeeIds, employeeSearch, data]);

  const toggle = (list, setList, id) =>
    setList(
      list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
    );

  const changeEmployeeSource = (value) => {
    setEmployeeSource(value);
    setSelectedContractorIds([]);
    setContractorSearch("");
    setSelectedTargetIds([]);
    setEmployeeSearch("");
  };

  const toggleContractor = (id) => toggle(selectedContractorIds, setSelectedContractorIds, id);

  // Unchecking a contractor should drop only the employees that are no
  // longer part of any checked contractor — not wipe the whole selection —
  // so picking more contractors never loses what was already selected.
  // Never runs off the search text alone, only when contractor membership
  // itself changes.
  useEffect(() => {
    if (employeeSource !== "subcontractor") return;
    setSelectedTargetIds((prev) => prev.filter((id) => contractorEmployeeIds.has(id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractorEmployeeIds, employeeSource]);

  const sortedRates = useMemo(() => {
    const visible = showArchived ? rates : activeOnly(rates);
    return [...visible].sort((a, b) => {
      const siteCompare = getName(sites, a.siteId).localeCompare(
        getName(sites, b.siteId),
        "he"
      );
      if (siteCompare !== 0) return siteCompare;
      // Newest effective date first within each site, oldest at the bottom.
      return String(b.effectiveFrom || "").localeCompare(
        String(a.effectiveFrom || "")
      );
    });
  }, [rates, sites, showArchived]);

  const [ratesPageSize, setRatesPageSize] = useState(5);

  const {
    pageItems: pagedRates,
    page: ratesPage,
    setPage: setRatesPage,
    totalPages: ratesTotalPages,
    startIndex: ratesStartIndex,
  } = usePagedList(sortedRates, ratesPageSize);

  useEffect(() => {
    setRatesPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ratesPageSize]);

  // Drops any selected id that's no longer in the visible (filtered) list —
  // covers both a single-row delete/archive-toggle on a selected row and
  // the showArchived filter hiding a previously-selected row — so "X
  // selected" never counts a row that's no longer on screen.
  useEffect(() => {
    const validIds = new Set(sortedRates.map((r) => r.id));
    setSelectedRateIds((prev) => prev.filter((id) => validIds.has(id)));
  }, [sortedRates]);

  const toggleRateSelection = (id) =>
    setSelectedRateIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  // "Select all" is scoped to the current page only — simplest behavior
  // for a paginated table, and selection isn't cleared on page change, so
  // rows picked on other pages stay picked.
  const isAllCurrentPageSelected =
    pagedRates.length > 0 && pagedRates.every((r) => selectedRateIds.includes(r.id));

  const toggleSelectAllCurrentPage = () =>
    setSelectedRateIds((prev) =>
      isAllCurrentPageSelected
        ? prev.filter((id) => !pagedRates.some((r) => r.id === id))
        : [...new Set([...prev, ...pagedRates.map((r) => r.id)])]
    );

  const bulkDeleteSelectedRates = async () => {
    if (
      !confirm(
        `למחוק ${selectedRateIds.length} תעריפים שנבחרו לצמיתות? בשונה מהעברה לארכיון, מחיקה תשפיע גם על חישובים כספיים היסטוריים שכבר השתמשו בתעריפים האלה.`
      )
    ) {
      return;
    }
    for (const id of selectedRateIds) {
      // eslint-disable-next-line no-await-in-loop
      await deleteItem("rates", id).catch(() => {});
    }
    setSelectedRateIds([]);
  };

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
    if (selectedTargetIds.length === 0) {
      alert("נא לבחור לפחות עובד אחד");
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
                String(rate.rateType) === "employee" &&
                normalizeDate(rate.effectiveFrom) === effectiveFrom;
              if (!sameBase) return false;
              return String(rate.employeeId || "") === String(targetId);
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
                rateType: "employee",
                subcontractorId: "",
                employeeId: targetId,
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

        <div className="filter-grid filter-grid-2">
          <div className="filter-grid-item">
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
          </div>

          <div className="filter-grid-item">
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
          </div>
        </div>

        <hr className="form-divider" />

        <div className="filter-grid filter-grid-2">
          <div className="filter-grid-item">
            <label>שיוך עובד</label>
            <div className="employee-actions">
              <button
                type="button"
                className={employeeSource === "internal" ? "primary-btn" : "secondary-btn"}
                onClick={() => changeEmployeeSource("internal")}
              >
                העובדים שלי
              </button>
              <button
                type="button"
                className={employeeSource === "subcontractor" ? "primary-btn" : "secondary-btn"}
                onClick={() => changeEmployeeSource("subcontractor")}
              >
                עובדי קבלן
              </button>
            </div>
          </div>

          <div className="filter-grid-item">
            <label>תאריך תחילה</label>
            <DatePicker mode="single" value={effectiveFrom} onChange={setEffectiveFrom} />
          </div>
        </div>

        {employeeSource === "subcontractor" ? (
          <div className="filter-grid filter-grid-2">
            <div className="filter-grid-item">
              <SelectionPanel
                title="בחירת קבלנים"
                search={contractorSearch}
                onSearchChange={setContractorSearch}
                searchPlaceholder="🔍 חפש קבלן..."
                items={activeSubcontractors
                  .filter(
                    (s) =>
                      !contractorSearch.trim() ||
                      s.name.toLowerCase().includes(contractorSearch.trim().toLowerCase())
                  )
                  .map((s) => ({ id: s.id, label: s.name }))}
                selectedIds={selectedContractorIds}
                onToggle={toggleContractor}
                onSelectAll={() =>
                  setSelectedContractorIds((prev) => [
                    ...new Set([...prev, ...activeSubcontractors.map((s) => s.id)]),
                  ])
                }
                onClearAll={() => setSelectedContractorIds([])}
                emptyMessage="אין קבלני משנה"
              />
            </div>

            <div className="filter-grid-item">
              {selectedContractorIds.length === 0 ? (
                <>
                  <label>בחר עובדים</label>
                  <div className="empty-message">יש לבחור קבלן תחילה</div>
                </>
              ) : (
                <SelectionPanel
                  title="בחר עובדים"
                  search={employeeSearch}
                  onSearchChange={setEmployeeSearch}
                  searchPlaceholder="🔍 חפש עובד..."
                  items={employeeTargets}
                  selectedIds={selectedTargetIds}
                  onToggle={(id) => toggle(selectedTargetIds, setSelectedTargetIds, id)}
                  onSelectAll={() =>
                    setSelectedTargetIds((prev) => [
                      ...new Set([...prev, ...employeeTargets.map((t) => t.id)]),
                    ])
                  }
                  onClearAll={() => setSelectedTargetIds([])}
                  emptyMessage="אין עובדים תואמים"
                />
              )}
            </div>
          </div>
        ) : (
          <SelectionPanel
            title="בחר עובדים"
            search={employeeSearch}
            onSearchChange={setEmployeeSearch}
            searchPlaceholder="🔍 חפש עובד..."
            items={employeeTargets}
            selectedIds={selectedTargetIds}
            onToggle={(id) => toggle(selectedTargetIds, setSelectedTargetIds, id)}
            onSelectAll={() => setSelectedTargetIds(employeeTargets.map((t) => t.id))}
            onClearAll={() => setSelectedTargetIds([])}
            emptyMessage="אין עובדים תואמים"
          />
        )}
        <p>סה״כ עובדים שנבחרו: {selectedTargetIds.length}</p>

        <hr className="form-divider" />

        <div className="filter-grid filter-grid-2">
          <div className="filter-grid-item">
            <label>הכנסה ליום</label>
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="כמה אתה מקבל עבור העובד"
              value={revenue}
              onChange={(e) => setRevenue(e.target.value)}
            />
          </div>

          <div className="filter-grid-item">
            <label>עלות ליום</label>
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="כמה העובד או הקבלן עולה לך"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
            />
          </div>
        </div>

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
        <div className="section-title-row">
          <h3>תעריפים קיימים - סה״כ {activeOnly(rates).length}</h3>
          <label className="checkbox-item" style={{ display: "inline-flex" }}>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            <span>הצג פריטים בארכיון</span>
          </label>
        </div>
        {sortedRates.length === 0 ? (
          <p>עדיין לא הוגדרו תעריפים.</p>
        ) : (
          <>
          {selectedRateIds.length > 0 && (
            <div className="worklog-bulk-actions">
              <span>{selectedRateIds.length} תעריפים נבחרו</span>
              <button className="delete-btn" type="button" onClick={bulkDeleteSelectedRates}>
                מחק את הנבחרים ({selectedRateIds.length})
              </button>
            </div>
          )}
          <div className="rates-table-scroll">
          <table>
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={isAllCurrentPageSelected}
                    onChange={toggleSelectAllCurrentPage}
                    aria-label="בחר הכל / נקה הכל"
                  />
                </th>
                <th>#</th>
                <th>מזמין עבודה</th>
                <th>אתר</th>
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
                const profitValue = revenueValue - costValue;

                return (
                  <tr key={rate.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedRateIds.includes(rate.id)}
                        onChange={() => toggleRateSelection(rate.id)}
                      />
                    </td>
                    <td>{ratesStartIndex + index + 1}</td>
                    <td>{getName(customers, rate.customerId) || "מזמין לא נמצא"}</td>
                    <td>{getName(sites, rate.siteId) || "אתר לא נמצא"}</td>
                    <td>{targetName || "לא נמצא"}</td>
                    <td>{affiliationName}</td>
                    <td>{formatCurrency(revenueValue)}</td>
                    <td>{formatCurrency(costValue)}</td>
                    <td className={profitValue >= 0 ? "rates-profit-positive" : "rates-profit-negative"}>
                      {formatCurrency(profitValue)}
                    </td>
                    <td dir="ltr">{formatExcelDate(rate.effectiveFrom)}</td>
                    <td><StatusBadge archived={rate.archived} /></td>
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
          </div>
          <ListPagination
            page={ratesPage}
            totalPages={ratesTotalPages}
            onPageChange={setRatesPage}
            pageSize={ratesPageSize}
            onPageSizeChange={setRatesPageSize}
            startIndex={ratesStartIndex}
            totalItems={sortedRates.length}
          />
          </>
        )}
      </div>

      {editingRate && (
        <EditRateModal rate={editingRate} onClose={() => setEditingRate(null)} />
      )}
    </>
  );
}
