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
import SelectionPanel from "../components/SelectionPanel.jsx";
import GroupCard from "../components/GroupCard.jsx";
import CompactRow from "../components/CompactRow.jsx";
import { usePagedList, ListPagination } from "../components/Pagination.jsx";
import { useBulkSelection } from "../components/useBulkSelection.js";
import { findRedundantAt } from "../lib/rateConsolidation.js";

export default function Rates() {
  const { data, addItem, updateItem, deleteItem } = useData();
  const { sites, employees, subcontractors, customers, rates } = data;

  const [selectedCustomerIds, setSelectedCustomerIds] = useState([]);
  const [selectedSiteIds, setSelectedSiteIds] = useState([]);
  const [selectedTargetIds, setSelectedTargetIds] = useState([]);
  const [revenue, setRevenue] = useState("");
  const [cost, setCost] = useState("");
  // Array of the rate(s) currently open in EditRateModal — a single-row
  // edit passes one rate, a group edit passes every rate in that group.
  const [editingRates, setEditingRates] = useState(null);
  const [effectiveFrom, setEffectiveFrom] = useState(todayISO());
  const [showArchived, setShowArchived] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // Rates that share customer + site + revenue + cost are presented as one
  // card (same "group card with a compact child list" pattern as
  // contractors/employees) — a unique rate is just a group of one, rendered
  // with the exact same card, not a different style. Effective-from date is
  // deliberately NOT part of the grouping key: it's shown per employee row
  // instead of in the group header, since two rates can share everything
  // else but start on different dates. Grouping is recomputed fresh from
  // `rates` on every render, so editing a single rate's shared fields away
  // from its group (or into another group) "moves" it automatically with
  // no extra bookkeeping.
  const groupedRates = useMemo(() => {
    const groups = new Map();
    sortedRates.forEach((rate) => {
      const key = JSON.stringify({
        customerId: String(rate.customerId || ""),
        siteId: String(rate.siteId || ""),
        revenue: Number(rate.revenuePerWorker) || 0,
        cost: Number(rate.costPerWorker) || 0,
      });
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          customerId: rate.customerId,
          siteId: rate.siteId,
          revenuePerWorker: Number(rate.revenuePerWorker) || 0,
          costPerWorker: Number(rate.costPerWorker) || 0,
          rates: [],
        });
      }
      groups.get(key).rates.push(rate);
    });
    return Array.from(groups.values());
  }, [sortedRates]);

  const [ratesPageSize, setRatesPageSize] = useState(5);

  // Pages through GROUPS (cards), not individual rate rows — otherwise a
  // group could be split across two pages.
  const {
    pageItems: pagedGroups,
    page: ratesPage,
    setPage: setRatesPage,
    totalPages: ratesTotalPages,
    startIndex: ratesStartIndex,
  } = usePagedList(groupedRates, ratesPageSize);

  const pagedRates = useMemo(() => pagedGroups.flatMap((g) => g.rates), [pagedGroups]);

  useEffect(() => {
    setRatesPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ratesPageSize]);

  const {
    selectedIds: selectedRateIds,
    toggle: toggleRateSelection,
    isFullySelected: isRateGroupFullySelected,
    toggleAll: toggleAllRates,
    clear: clearRateSelection,
  } = useBulkSelection(sortedRates);

  // "Select all" is scoped to the current page only — simplest behavior
  // for a paginated table, and selection isn't cleared on page change, so
  // rows picked on other pages stay picked.
  const isAllCurrentPageSelected = isRateGroupFullySelected(pagedRates);
  const toggleSelectAllCurrentPage = () => toggleAllRates(pagedRates);

  // Per-card "select all" — scoped to just this group's rates, independent
  // of every other card and of the page-level "select all" above (both
  // read/write the same selectedRateIds array, just intersected with a
  // different id subset, so neither has to know about the other).
  const isGroupFullySelected = (group) => isRateGroupFullySelected(group.rates);
  const toggleSelectAllInGroup = (group) => toggleAllRates(group.rates);

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
    clearRateSelection();
  };

  const bulkArchiveSelectedRates = async () => {
    if (
      !confirm(
        `להעביר את ${selectedRateIds.length} התעריפים שנבחרו לארכיון? התעריפים לא יופיעו יותר לבחירה, אבל הדוחות הקיימים לא ישתנו.`
      )
    ) {
      return;
    }
    for (const id of selectedRateIds) {
      // eslint-disable-next-line no-await-in-loop
      await updateItem("rates", id, { archived: true });
    }
    clearRateSelection();
  };

  // Every delete button on this page (row/group/bulk) is hidden until this
  // is checked — "ארכיון"/"ערוך" stay visible either way, since only delete
  // is dangerous enough to need a second, explicit door.
  const [advancedModeEnabled, setAdvancedModeEnabled] = useState(false);

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

  // Group-level actions apply to every rate in the group together — the
  // group only exists because they all share customer/site/revenue/cost/
  // effective-date, so archiving/deleting "the group" means archiving/
  // deleting all of them.
  const isGroupArchived = (group) => group.rates.every((r) => r.archived);

  const toggleRateGroupArchive = async (group) => {
    if (isGroupArchived(group)) {
      for (const rate of group.rates) {
        // eslint-disable-next-line no-await-in-loop
        await updateItem("rates", rate.id, { archived: false });
      }
      return;
    }
    if (
      !confirm(
        `להעביר את כל ${group.rates.length} התעריפים בקבוצה לארכיון? התעריפים לא יופיעו יותר לבחירה, אבל הדוחות הקיימים לא ישתנו.`
      )
    ) {
      return;
    }
    for (const rate of group.rates) {
      // eslint-disable-next-line no-await-in-loop
      await updateItem("rates", rate.id, { archived: true });
    }
  };

  const deleteRateGroup = async (group) => {
    if (
      !confirm(
        `למחוק את כל ${group.rates.length} התעריפים בקבוצה לצמיתות? בשונה מהעברה לארכיון, מחיקה תשפיע גם על חישובים כספיים היסטוריים שכבר השתמשו בתעריפים האלה.`
      )
    ) {
      return;
    }
    for (const rate of group.rates) {
      // eslint-disable-next-line no-await-in-loop
      await deleteItem("rates", rate.id);
    }
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
      let extendedCount = 0;

      // Archived rates are old history, not something a new rate should be
      // treated as a duplicate of — otherwise a rate that happens to share
      // a date/site/customer with something archived gets silently skipped
      // and the user sees nothing added, with no error.
      const activeRates = activeOnly(rates);

      for (const customerId of selectedCustomerIds) {
        for (const siteId of selectedSiteIds) {
          for (const targetId of selectedTargetIds) {
            // An outright conflict — something already claims this exact
            // date for this employee+customer+site, regardless of pay —
            // is always a duplicate; two records can't both be "in effect"
            // on the same day.
            const sameDateConflict = activeRates.some(
              (rate) =>
                String(rate.customerId || "") === String(customerId) &&
                String(rate.siteId) === String(siteId) &&
                String(rate.rateType) === "employee" &&
                String(rate.employeeId || "") === String(targetId) &&
                normalizeDate(rate.effectiveFrom) === effectiveFrom
            );

            if (sameDateConflict) {
              skippedCount += 1;
              continue;
            }

            // Beyond that, check whether this employee's own rate history
            // at this customer+site already covers `effectiveFrom` with
            // the exact same pay (a redundant continuation of an existing
            // run), or whether it should instead pull an existing record's
            // start date backward rather than add a second record for the
            // same run — see lib/rateConsolidation.js.
            const employeeSiteRates = activeRates.filter(
              (rate) =>
                rate.rateType === "employee" &&
                String(rate.employeeId || "") === String(targetId) &&
                String(rate.customerId || "") === String(customerId) &&
                String(rate.siteId) === String(siteId)
            );
            const redundancy = findRedundantAt(
              employeeSiteRates,
              effectiveFrom,
              revenuePerWorker,
              costPerWorker
            );

            if (redundancy.action === "skip") {
              skippedCount += 1;
              continue;
            }

            try {
              if (redundancy.action === "extend") {
                // eslint-disable-next-line no-await-in-loop
                await updateItem("rates", redundancy.anchor.id, { effectiveFrom });
                extendedCount += 1;
              } else {
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
              }
            } catch (err) {
              alert(`שגיאה בהוספת תעריף: ${err.message || "שגיאה לא ידועה"}`);
              return;
            }
          }
        }
      }

      if (addedCount === 0 && extendedCount === 0) {
        alert("לא נוספו תעריפים. כל השילובים שנבחרו כבר קיימים כתעריפים פעילים באותה תקופה.");
        return;
      }

      setSelectedCustomerIds([]);
      setSelectedSiteIds([]);
      setSelectedTargetIds([]);
      setRevenue("");
      setCost("");

      const parts = [];
      if (addedCount > 0) parts.push(`נוספו ${addedCount} תעריפים`);
      if (extendedCount > 0) parts.push(`${extendedCount} תעריפים קיימים הורחבו לתאריך המוקדם יותר`);
      if (skippedCount > 0) parts.push(`${skippedCount} שילובים כבר היו קיימים באותה תקופה ולא נוספו שוב`);
      alert(`${parts.join(". ")}.`);
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
                בחר הכל
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
                בחר הכל
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
            {selectedRateIds.length > 0 && (
              <div className="report-row-actions bulk-actions-inline">
                <button className="archive-btn" type="button" onClick={bulkArchiveSelectedRates}>
                  ארכיון ({selectedRateIds.length})
                </button>
                {advancedModeEnabled && (
                  <button className="delete-btn" type="button" onClick={bulkDeleteSelectedRates}>
                    מחק ({selectedRateIds.length})
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="employees-contractor-list">
            {pagedGroups.map((group) => {
              const groupArchived = isGroupArchived(group);
              const groupProfit = group.revenuePerWorker - group.costPerWorker;
              return (
                <GroupCard
                  key={group.key}
                  icon="payments"
                  selectionControl={
                    <input
                      type="checkbox"
                      checked={isGroupFullySelected(group)}
                      onChange={() => toggleSelectAllInGroup(group)}
                      aria-label={`בחר הכל - ${getName(customers, group.customerId) || "מזמין לא נמצא"} · ${
                        getName(sites, group.siteId) || "אתר לא נמצא"
                      }`}
                    />
                  }
                  title={`${getName(customers, group.customerId) || "מזמין לא נמצא"} · ${
                    getName(sites, group.siteId) || "אתר לא נמצא"
                  }`}
                  count={group.rates.length}
                  countLabel={group.rates.length === 1 ? "עובד" : "עובדים"}
                  isArchived={groupArchived}
                  groupActions={
                    <div className="report-row-actions">
                      <button
                        className="edit-btn"
                        type="button"
                        onClick={() => setEditingRates(group.rates)}
                      >
                        ערוך קבוצה
                      </button>
                      {advancedModeEnabled && (
                        <button
                          className="delete-btn"
                          type="button"
                          onClick={() => deleteRateGroup(group)}
                        >
                          מחק קבוצה
                        </button>
                      )}
                      <button
                        className="archive-btn"
                        type="button"
                        onClick={() => toggleRateGroupArchive(group)}
                      >
                        {groupArchived ? "שחזר" : "ארכיון"}
                      </button>
                    </div>
                  }
                >
                  <div className="rates-group-summary">
                    <span>הכנסה: {formatCurrency(group.revenuePerWorker)}</span>
                    <span>עלות: {formatCurrency(group.costPerWorker)}</span>
                    <span className={groupProfit >= 0 ? "rates-profit-positive" : "rates-profit-negative"}>
                      רווח: {formatCurrency(groupProfit)}
                    </span>
                  </div>
                  <div className="employees-compact-list">
                    {group.rates.map((rate) => {
                      const isEmployeeRate = rate.rateType === "employee";
                      const employee = isEmployeeRate
                        ? employees.find((e) => String(e.id) === String(rate.employeeId))
                        : null;
                      const targetName = isEmployeeRate
                        ? employee?.name || ""
                        : getName(subcontractors, rate.subcontractorId);
                      const affiliationName =
                        isEmployeeRate && employee
                          ? getEmployeeAffiliationName(data, employee)
                          : "קבלן משנה";
                      return (
                        <CompactRow
                          key={rate.id}
                          name={
                            <>
                              {targetName || "לא נמצא"} - {affiliationName}
                              {" · "}
                              <span dir="ltr" className="rates-row-date">
                                {formatExcelDate(rate.effectiveFrom)}
                              </span>
                            </>
                          }
                          archived={rate.archived}
                          selected={selectedRateIds.includes(rate.id)}
                          onToggleSelect={() => toggleRateSelection(rate.id)}
                          onDelete={advancedModeEnabled ? () => deleteRate(rate) : undefined}
                          onToggleArchive={() => toggleRateArchive(rate)}
                        />
                      );
                    })}
                  </div>
                </GroupCard>
              );
            })}
          </div>

          <ListPagination
            page={ratesPage}
            totalPages={ratesTotalPages}
            onPageChange={setRatesPage}
            pageSize={ratesPageSize}
            onPageSizeChange={setRatesPageSize}
            startIndex={ratesStartIndex}
            totalItems={groupedRates.length}
          />
          </>
        )}
      </div>

      {editingRates && (
        <EditRateModal rates={editingRates} onClose={() => setEditingRates(null)} />
      )}
    </>
  );
}
