import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useData } from "../state/DataProvider.jsx";
import { useConfirm } from "../state/ConfirmProvider.jsx";
import { useToast } from "../state/ToastProvider.jsx";
import { normalizeDate, formatExcelDate } from "../lib/format.js";
import { isoRangeInclusive, todayISO } from "../lib/calendar.js";
import {
  getName,
  getEmployeeIds,
  getBuildingIds,
  getEmployeeAffiliationName,
  getBuildingNames,
  activeOnly,
  activeEmployees,
  groupEmployeesByAffiliation,
} from "../lib/entities.js";
import { getReportEmployees } from "../lib/reports.js";
import DatePicker from "../components/DatePicker.jsx";
import DuplicateConflictModal from "../components/DuplicateConflictModal.jsx";
import WorkforceSelectionFields from "../components/WorkforceSelectionFields.jsx";
import WorkRecordCard from "../components/WorkRecordCard.jsx";
import { useBulkOperation } from "../components/useBulkOperation.jsx";

const VALIDATION_MESSAGE = "נא לבחור תאריך, עובד, אתר, מבנה ומזמין";

function rangeLabel(range) {
  return range.start === range.end
    ? formatExcelDate(range.start)
    : `${formatExcelDate(range.start)} - ${formatExcelDate(range.end)}`;
}

export default function WorkLog() {
  const { data, addItem, updateItem, deleteItem } = useData();
  const confirmDialog = useConfirm();
  const { showToast } = useToast();
  const { overlay: bulkOverlay, run: runBulkOperation } = useBulkOperation();
  const { subcontractors, sites, buildings, customers, workLogs } = data;
  // Pickers for a NEW entry must exclude archived records; the recent-
  // records list below still needs the full (unfiltered) lists so it can
  // keep resolving names for entries that reference an already-archived
  // record.
  const employees = activeEmployees(data);
  const pickableSites = activeOnly(sites);
  const pickableCustomers = activeOnly(customers);

  // Multiple independent date ranges (not just one from/to), so the same
  // employees/site/building/customer can be logged for several separate
  // spans (e.g. two different work weeks) in one submit. Defaults to today
  // — the common case is logging today's work, so it should already count
  // toward "ייווצרו X רשומות" without the user having to pick it manually.
  // Clicking today's cell in the calendar removes it, same as clicking any
  // other already-selected range — that's the existing, intentional
  // "click an existing range to delete it" behavior, not special-cased.
  const [selectedRanges, setSelectedRanges] = useState([
    { start: todayISO(), end: todayISO() },
  ]);
  const [group, setGroup] = useState(""); // "" | "internal" | "all-subcontractors"
  const [selectedContractorIds, setSelectedContractorIds] = useState([]);
  const [contractorSearch, setContractorSearch] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [siteId, setSiteId] = useState("");
  const [buildingSearch, setBuildingSearch] = useState("");
  const [selectedBuildings, setSelectedBuildings] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicateConflict, setDuplicateConflict] = useState(null);
  const [editingLogId, setEditingLogId] = useState(null);
  const [selectedRecentLogIds, setSelectedRecentLogIds] = useState([]);
  // Every delete button in "רשומות אחרונות" (row/bulk) is hidden until
  // this is checked — matches the same convention already used on
  // Customers/Employees/Sites/Rates.
  const [advancedModeEnabled, setAdvancedModeEnabled] = useState(false);

  // Every interactive way the contractor set can change (a single toggle or
  // the panel's own בחר הכל/נקה הכל) clears the employee selection, since
  // it may no longer be valid under the new set. startEdit/cancelEdit reset
  // selectedContractorIds directly (not through these) because they set
  // selectedEmployees themselves right after, in the same batch.
  const changeWorkforceType = (value) => {
    setGroup(value);
    setSelectedContractorIds([]);
    setSelectedEmployees([]);
  };

  const toggleContractor = (id) => {
    setSelectedContractorIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setSelectedEmployees([]);
  };

  const selectAllContractors = () => {
    setSelectedContractorIds((prev) => [
      ...new Set([...prev, ...relevantContractors.map((s) => s.id)]),
    ]);
    setSelectedEmployees([]);
  };

  const clearAllContractors = () => {
    setSelectedContractorIds([]);
    setSelectedEmployees([]);
  };

  const relevantContractors = useMemo(() => {
    if (group !== "all-subcontractors") return [];
    const idsWithEmployees = new Set(
      employees
        .filter((e) => e.type !== "internal")
        .map((e) => String(e.subcontractorId || ""))
    );
    const text = contractorSearch.trim().toLowerCase();
    return activeOnly(subcontractors).filter(
      (s) => idsWithEmployees.has(String(s.id)) && (!text || s.name.toLowerCase().includes(text))
    );
  }, [subcontractors, employees, group, contractorSearch]);

  const employeeOptions = useMemo(() => {
    const text = employeeSearch.trim().toLowerCase();
    return employees.filter((employee) => {
      const isInternal = employee.type === "internal";
      if (group === "internal" && !isInternal) return false;
      if (group === "all-subcontractors") {
        if (isInternal) return false;
        if (!selectedContractorIds.includes(String(employee.subcontractorId || "")))
          return false;
      }
      if (text && !employee.name.toLowerCase().includes(text)) return false;
      return true;
    });
  }, [employees, group, selectedContractorIds, employeeSearch]);

  const toggleEmployee = (id) =>
    setSelectedEmployees((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const selectAllEmployees = () =>
    setSelectedEmployees((prev) => [
      ...new Set([...prev, ...employeeOptions.map((e) => e.id)]),
    ]);

  const allSiteBuildings = useMemo(() => {
    if (!siteId) return [];
    return activeOnly(buildings).filter((b) => String(b.siteId) === String(siteId));
  }, [buildings, siteId]);

  const siteBuildings = useMemo(() => {
    const text = buildingSearch.trim().toLowerCase();
    return allSiteBuildings.filter((b) => !text || b.name.toLowerCase().includes(text));
  }, [allSiteBuildings, buildingSearch]);

  const toggleBuilding = (id) =>
    setSelectedBuildings((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const selectAllBuildings = () =>
    setSelectedBuildings((prev) => [
      ...new Set([...prev, ...siteBuildings.map((b) => b.id)]),
    ]);

  // Changing the site clears whatever building selection belonged to the
  // previous site — except when the new site has exactly one building,
  // which is pre-checked as a convenience (the picker stays fully active
  // and editable either way). If the site has ever been used with exactly
  // one customer (via existing rates) and no customer has been picked yet,
  // that customer is auto-selected too — a convenience default that never
  // overrides a customer the user already chose, and not a new data
  // relationship.
  const changeSite = (value) => {
    setSiteId(value);
    setBuildingSearch("");
    const buildingsAtSite = activeOnly(buildings).filter(
      (b) => String(b.siteId) === String(value)
    );
    setSelectedBuildings(buildingsAtSite.length === 1 ? [buildingsAtSite[0].id] : []);

    if (!customerId) {
      const relatedCustomerIds = [
        ...new Set(
          (data.rates || [])
            .filter((r) => String(r.siteId) === String(value) && r.customerId)
            .map((r) => String(r.customerId))
        ),
      ];
      if (relatedCustomerIds.length === 1) setCustomerId(relatedCustomerIds[0]);
    }
  };

  // Catches the same employee accidentally being logged twice on the same
  // date — matches on date only, regardless of site: an employee can't
  // really work two different sites on the same day either, so a match at
  // *any* site on that date is still a real conflict. `excludeLogIds` skips
  // the record currently being edited, so re-saving it without changes
  // doesn't flag it as a duplicate of itself.
  const findDuplicateConflicts = (employeeIds, targetDates, excludeLogIds = []) => {
    const excludeSet = new Set(excludeLogIds.map(String));
    const dateSet = new Set(targetDates);
    const conflicts = [];
    workLogs.forEach((log) => {
      if (excludeSet.has(String(log.id))) return;
      const logDate = normalizeDate(log.date);
      if (!dateSet.has(logDate)) return;
      const existingEmployeeIds = getEmployeeIds(log).map(String);
      employeeIds.forEach((employeeId) => {
        if (existingEmployeeIds.includes(String(employeeId))) {
          conflicts.push({ employeeId, date: logDate, siteId: log.siteId });
        }
      });
    });
    return conflicts;
  };

  const recentWorkLogs = useMemo(
    () =>
      [...workLogs]
        .sort((a, b) => normalizeDate(b.date).localeCompare(normalizeDate(a.date)))
        .slice(0, 10),
    [workLogs]
  );

  const toggleRecentLogSelection = (id) =>
    setSelectedRecentLogIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const toggleSelectAllRecentLogs = () =>
    setSelectedRecentLogIds((prev) =>
      prev.length === recentWorkLogs.length ? [] : recentWorkLogs.map((log) => log.id)
    );

  const bulkDeleteSelected = async () => {
    const total = selectedRecentLogIds.length;
    if (
      !(await confirmDialog(`למחוק ${total} רשומות שנבחרו לצמיתות?`, {
        title: "מחיקה לצמיתות?",
        confirmLabel: "מחק לצמיתות",
        danger: true,
      }))
    ) {
      return;
    }
    await runBulkOperation("מוחק רשומות עבודה", total, async (setProgress) => {
      let done = 0;
      for (const id of selectedRecentLogIds) {
        // eslint-disable-next-line no-await-in-loop
        await deleteItem("workLogs", id, { silent: true }).catch(() => {});
        done += 1;
        setProgress(done);
      }
    });
    setSelectedRecentLogIds([]);
    showToast("success", `${total} רשומות עבודה נמחקו בהצלחה`);
  };

  const uniqueDates = useMemo(() => {
    const set = new Set();
    selectedRanges.forEach((range) =>
      isoRangeInclusive(range.start, range.end).forEach((iso) => set.add(iso))
    );
    return Array.from(set).sort();
  }, [selectedRanges]);

  const removeRange = (index) =>
    setSelectedRanges((prev) => prev.filter((_, i) => i !== index));

  const cancelEdit = () => {
    setEditingLogId(null);
    setSelectedRecentLogIds([]);
    setSelectedRanges([{ start: todayISO(), end: todayISO() }]);
    setGroup("");
    setSelectedContractorIds([]);
    setContractorSearch("");
    setEmployeeSearch("");
    setSelectedEmployees([]);
    setSiteId("");
    setBuildingSearch("");
    setSelectedBuildings([]);
    setCustomerId("");
    setNotes("");
  };

  const startEdit = (log) => {
    setEditingLogId(log.id);
    // Reset the workforce filter to "כל העובדים" so the loaded employees are
    // guaranteed to be visible in the panel regardless of their affiliation.
    setGroup("");
    setSelectedContractorIds([]);
    setContractorSearch("");
    setEmployeeSearch("");
    setSelectedEmployees(getEmployeeIds(log));
    setSiteId(log.siteId || "");
    setBuildingSearch("");
    setSelectedBuildings(getBuildingIds(log));
    setCustomerId(log.customerId || "");
    setNotes(log.notes || "");
    setSelectedRanges([{ start: normalizeDate(log.date), end: normalizeDate(log.date) }]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const add = async () => {
    // Guards against a double-click (or a slow request plus a second
    // click before it lands) submitting the same entry/range twice.
    if (isSubmitting) return;

    if (
      selectedRanges.length === 0 ||
      selectedEmployees.length === 0 ||
      !siteId ||
      selectedBuildings.length === 0 ||
      !customerId
    ) {
      alert(VALIDATION_MESSAGE);
      return;
    }

    // Editing represents exactly one existing daily record — restricting to
    // exactly one date keeps "שמור שינויים" from silently turning into a
    // multi-record creation. Multiple buildings are fine (just a tag set).
    if (editingLogId) {
      if (uniqueDates.length > 1) {
        alert("בעריכת רשומה ניתן לבחור תאריך אחד בלבד.");
        return;
      }
    }

    const datesToUse = editingLogId ? uniqueDates.slice(0, 1) : uniqueDates;

    const conflicts = findDuplicateConflicts(
      selectedEmployees,
      datesToUse,
      editingLogId ? [editingLogId] : []
    );
    if (conflicts.length > 0) {
      const seen = new Set();
      const rows = [];
      conflicts.forEach((c) => {
        const key = `${c.employeeId}-${c.date}-${c.siteId}`;
        if (seen.has(key)) return;
        seen.add(key);
        rows.push({
          employeeName: getName(data.employees, c.employeeId) || "עובד",
          date: c.date,
          siteName: getName(sites, c.siteId) || "אתר לא ידוע",
        });
      });
      // Sort on the raw ISO date (chronologically correct) BEFORE
      // reformatting for display — formatExcelDate's DD-MM-YYYY string
      // wouldn't sort correctly with localeCompare.
      rows.sort((a, b) => a.date.localeCompare(b.date) || a.employeeName.localeCompare(b.employeeName));
      setDuplicateConflict(rows.map((row) => ({ ...row, date: formatExcelDate(row.date) })));
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingLogId) {
        await updateItem("workLogs", editingLogId, {
          date: datesToUse[0],
          employeeIds: selectedEmployees,
          buildingIds: selectedBuildings,
          siteId,
          customerId,
          notes: notes.trim(),
        });
        cancelEdit();
        return;
      }

      // One record per unique day — a building is just a location tag on
      // the record (the site is the billing unit), so selecting several
      // buildings for the same day stores them all on that single record
      // instead of multiplying it into one record per building (which used
      // to double-count revenue/cost for that day).
      const createdIds = [];
      let creationFailed = false;

      await runBulkOperation("יוצר רשומות עבודה", datesToUse.length, async (setProgress) => {
        try {
          for (const logDate of datesToUse) {
            // eslint-disable-next-line no-await-in-loop
            const created = await addItem(
              "workLogs",
              {
                date: logDate,
                employeeIds: selectedEmployees,
                buildingIds: selectedBuildings,
                siteId,
                customerId,
                notes: notes.trim(),
              },
              // The overlay owns user feedback for this whole batch — a
              // single summary toast/alert fires once it closes below,
              // instead of one automatic toast per created record.
              { silent: true }
            );
            createdIds.push(created.id);
            setProgress(createdIds.length);
          }
        } catch (err) {
          // A failure partway through must not leave a partial batch behind —
          // there's no server-side transaction spanning these calls, so roll
          // back everything this batch already created.
          creationFailed = true;
          for (const id of createdIds) {
            // eslint-disable-next-line no-await-in-loop
            await deleteItem("workLogs", id, { silent: true }).catch(() => {});
          }
          console.error("Batch work-log creation failed, rolled back:", err);
        }
      });

      if (creationFailed) {
        alert("אירעה שגיאה בהוספת הרשומות. הפעולה בוטלה ולא נוצרו רשומות חלקיות.");
        return;
      }

      setSelectedEmployees([]);
      setSelectedBuildings([]);
      setNotes("");

      showToast(
        "success",
        createdIds.length > 1
          ? `נוצרו ${createdIds.length} רשומות עבודה (${datesToUse.length} ימי עבודה).`
          : "נוצרה רשומת עבודה בהצלחה"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const customerName = getName(customers, customerId);
  const siteName = getName(sites, siteId);
  const buildingNamesText = selectedBuildings
    .map((id) => getName(buildings, id))
    .filter(Boolean)
    .join(", ");

  const dateSummaryText =
    uniqueDates.length === 0
      ? "לא נבחרו תאריכים"
      : selectedRanges.length === 1
        ? rangeLabel(selectedRanges[0])
        : `${uniqueDates.length} ימים ב-${selectedRanges.length} טווחים`;

  const selectedEmployeeItems = employees
    .filter((e) => selectedEmployees.includes(e.id))
    .map((e) => ({ id: e.id, label: `${e.name} - ${getEmployeeAffiliationName(data, e)}` }));

  // One record per date, regardless of how many buildings are tagged —
  // buildings never multiply the record (or financial) count.
  const recordsCount = editingLogId ? Math.min(uniqueDates.length, 1) : uniqueDates.length;

  return (
    <>
      <div className="card">
        <h3>{editingLogId ? "עריכת רשומת עבודה" : "רישום עבודה"}</h3>

        <div className="form-section">
          <h4 className="form-section-title">מיקום העבודה</h4>
          <div className="filter-grid filter-grid-2 worklog-location-grid">
            <div className="filter-grid-item">
              <label>תאריכי העבודה</label>
              <DatePicker mode="multi-range" value={selectedRanges} onChange={setSelectedRanges} />

              {selectedRanges.length > 0 && (
                <>
                  <div className="filter-chips">
                    {selectedRanges.map((range, index) => (
                      <span className="filter-chip" key={`${range.start}-${range.end}-${index}`}>
                        {rangeLabel(range)}
                        <button
                          type="button"
                          className="filter-chip-remove"
                          onClick={() => removeRange(index)}
                          aria-label="הסר טווח תאריכים"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <p>
                    נבחרו {uniqueDates.length} ימי עבודה
                    {selectedRanges.length > 1 ? ` · ${selectedRanges.length} טווחי תאריכים` : ""}
                  </p>
                </>
              )}
            </div>

            <div className="filter-grid-item">
              <label>מזמין עבודה</label>
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">בחר מזמין</option>
                {pickableCustomers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-grid-item">
              <label>אתר עבודה</label>
              <select value={siteId} onChange={(e) => changeSite(e.target.value)}>
                <option value="">בחר אתר</option>
                {pickableSites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-grid-item">
              <div className={`buildings-section${siteId ? "" : " is-disabled"}`}>
                <label>
                  מבנה
                  <span className="required-mark"> *</span>
                </label>

                <input
                  type="text"
                  placeholder="🔍 חפש מבנה..."
                  value={buildingSearch}
                  onChange={(e) => setBuildingSearch(e.target.value)}
                  disabled={!siteId}
                />

                <div className="checkbox-list">
                  {!siteId ? (
                    <div className="empty-message">יש לבחור אתר עבודה תחילה</div>
                  ) : siteBuildings.length === 0 ? (
                    <div className="empty-message">אין מבנים באתר הזה</div>
                  ) : (
                    siteBuildings.map((building) => (
                      <label className="checkbox-item" key={building.id}>
                        <input
                          type="checkbox"
                          checked={selectedBuildings.includes(building.id)}
                          onChange={() => toggleBuilding(building.id)}
                        />
                        <span>{building.name}</span>
                      </label>
                    ))
                  )}
                </div>

                {siteId && selectedBuildings.length > 0 && (
                  <div className="filter-chips">
                    {selectedBuildings.map((id) => (
                      <span className="filter-chip" key={id}>
                        {getName(buildings, id) || "מבנה"}
                        <button
                          type="button"
                          className="filter-chip-remove"
                          onClick={() => toggleBuilding(id)}
                          aria-label="הסר מבנה"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="building-actions">
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={selectAllBuildings}
                    disabled={!siteId}
                  >
                    בחר הכל
                  </button>
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => setSelectedBuildings([])}
                    disabled={!siteId}
                  >
                    נקה הכל
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <hr className="form-divider" />

        <div className="form-section">
          <h4 className="form-section-title">בחירת כוח אדם</h4>
          <WorkforceSelectionFields
            group={group}
            onGroupChange={changeWorkforceType}
            contractorSearch={contractorSearch}
            onContractorSearchChange={setContractorSearch}
            contractorItems={relevantContractors.map((s) => ({ id: s.id, label: s.name }))}
            selectedContractorIds={selectedContractorIds}
            onToggleContractor={toggleContractor}
            onSelectAllContractors={selectAllContractors}
            onClearAllContractors={clearAllContractors}
            employeeSearch={employeeSearch}
            onEmployeeSearchChange={setEmployeeSearch}
            employeeItems={employeeOptions.map((e) => ({
              id: e.id,
              label: `${e.name} - ${getEmployeeAffiliationName(data, e)}`,
            }))}
            selectedEmployeeIds={selectedEmployees}
            onToggleEmployee={toggleEmployee}
            onSelectAllEmployees={selectAllEmployees}
            onClearAllEmployees={() => setSelectedEmployees([])}
            selectedEmployeeItems={selectedEmployeeItems}
            required
          />
        </div>

        <hr className="form-divider" />

        <div className="form-section">
          <h4 className="form-section-title">סיכום והוספה</h4>

          <div className="worklog-summary-panel">
            <div className="worklog-stat-cards">
              <div className="worklog-stat-card">
                <span className="worklog-stat-value">{uniqueDates.length}</span>
                <span className="worklog-stat-label">ימי עבודה</span>
              </div>
              <div className="worklog-stat-card">
                <span className="worklog-stat-value">{selectedBuildings.length}</span>
                <span className="worklog-stat-label">מבנים</span>
              </div>
              <div className="worklog-stat-card">
                <span className="worklog-stat-value">{selectedEmployees.length}</span>
                <span className="worklog-stat-label">עובדים</span>
              </div>
            </div>
            <div className="worklog-summary-row">
              <span className="worklog-summary-label">תאריכים</span>
              <span>{dateSummaryText}</span>
            </div>
            <div className="worklog-summary-row">
              <span className="worklog-summary-label">מזמין עבודה</span>
              <span>{customerName || "לא נבחר"}</span>
            </div>
            <div className="worklog-summary-row">
              <span className="worklog-summary-label">אתר עבודה</span>
              <span>{siteName || "לא נבחר"}</span>
            </div>
            <div className="worklog-summary-row">
              <span className="worklog-summary-label">מבנים נבחרים</span>
              <span>{buildingNamesText || "לא נבחר"}</span>
            </div>
            <p className="worklog-summary-highlight">
              {editingLogId ? `יעודכנו ${recordsCount} רשומות` : `ייווצרו ${recordsCount} רשומות`}
            </p>

            <label>הערות</label>
            <textarea
              className="worklog-compact-textarea"
              placeholder="אופציונלי"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            ></textarea>

            <div className="employee-actions" style={{ marginBottom: 0 }}>
              <button
                className="primary-btn"
                type="button"
                onClick={add}
                disabled={isSubmitting}
              >
                {isSubmitting ? "שומר..." : editingLogId ? "שמור שינויים" : "הוסף ליומן"}
              </button>
              {editingLogId && (
                <button
                  className="secondary-btn"
                  type="button"
                  onClick={cancelEdit}
                  disabled={isSubmitting}
                >
                  ביטול עריכה
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="section-title-row">
          <h3 style={{ marginBottom: 0 }}>רשומות אחרונות</h3>
          <Link to="/work-history" className="secondary-btn">
            לכל היסטוריית העבודה
          </Link>
        </div>

        {recentWorkLogs.length === 0 ? (
          <p style={{ marginTop: 16 }}>אין עדיין רשומות</p>
        ) : (
          <>
            <div className="bulk-select-row">
              {advancedModeEnabled && (
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={
                      selectedRecentLogIds.length === recentWorkLogs.length &&
                      recentWorkLogs.length > 0
                    }
                    onChange={toggleSelectAllRecentLogs}
                  />
                  <span>בחר הכל</span>
                </label>
              )}
              <label className="checkbox-item">
                <input
                  type="checkbox"
                  checked={advancedModeEnabled}
                  onChange={(e) => setAdvancedModeEnabled(e.target.checked)}
                />
                <span>מצב מתקדם</span>
              </label>
              {advancedModeEnabled && selectedRecentLogIds.length > 0 && (
                <div className="report-row-actions bulk-actions-inline">
                  <button className="delete-btn" type="button" onClick={bulkDeleteSelected}>
                    מחק ({selectedRecentLogIds.length})
                  </button>
                </div>
              )}
            </div>

            <div className="workhistory-cards-list">
              {recentWorkLogs.map((log) => {
                const buildingNamesText = getBuildingNames(data, log);
                const logEmployees = getReportEmployees(data, log, {});
                return (
                  <WorkRecordCard
                    key={log.id}
                    date={formatExcelDate(log.date)}
                    customerName={getName(customers, log.customerId)}
                    siteName={getName(sites, log.siteId)}
                    buildingNamesText={buildingNamesText}
                    employeeCount={logEmployees.length}
                    affiliationGroups={groupEmployeesByAffiliation(data, logEmployees)}
                    selectionControl={
                      advancedModeEnabled && (
                        <input
                          type="checkbox"
                          checked={selectedRecentLogIds.includes(log.id)}
                          onChange={() => toggleRecentLogSelection(log.id)}
                        />
                      )
                    }
                    actions={
                      <>
                        <button className="edit-btn" type="button" onClick={() => startEdit(log)}>
                          עריכה
                        </button>
                        {advancedModeEnabled && (
                          <button
                            className="delete-btn"
                            type="button"
                            onClick={async () => {
                              if (
                                await confirmDialog("למחוק את הרשומה לצמיתות?", {
                                  title: "מחיקה לצמיתות?",
                                  confirmLabel: "מחק לצמיתות",
                                  danger: true,
                                })
                              ) {
                                deleteItem("workLogs", log.id);
                              }
                            }}
                          >
                            מחיקה
                          </button>
                        )}
                      </>
                    }
                  />
                );
              })}
            </div>
          </>
        )}
      </div>

      {duplicateConflict && (
        <DuplicateConflictModal
          conflicts={duplicateConflict}
          onClose={() => setDuplicateConflict(null)}
        />
      )}

      {bulkOverlay}
    </>
  );
}
