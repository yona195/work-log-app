import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useData } from "../state/DataProvider.jsx";
import { normalizeDate, formatExcelDate } from "../lib/format.js";
import { isoRangeInclusive } from "../lib/calendar.js";
import {
  getName,
  getEmployeeIds,
  getBuildingIds,
  getEmployeeAffiliationName,
  getEmployeeNames,
  getBuildingNames,
  activeOnly,
  activeEmployees,
} from "../lib/entities.js";
import DatePicker from "../components/DatePicker.jsx";
import DuplicateConflictModal from "../components/DuplicateConflictModal.jsx";
import SelectionPanel from "../components/SelectionPanel.jsx";
import SelectedItemsPanel from "../components/SelectedItemsPanel.jsx";

const VALIDATION_MESSAGE = "נא לבחור תאריך, עובד, אתר, מבנה ומזמין";

function rangeLabel(range) {
  return range.start === range.end
    ? formatExcelDate(range.start)
    : `${formatExcelDate(range.start)} - ${formatExcelDate(range.end)}`;
}

export default function WorkLog() {
  const { data, addItem, updateItem, deleteItem } = useData();
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
  // spans (e.g. two different work weeks) in one submit. Starts empty —
  // pre-selecting today by default meant clicking today again removed it
  // instead of starting a range from it.
  const [selectedRanges, setSelectedRanges] = useState([]);
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

  const hasSingleBuilding = allSiteBuildings.length === 1;

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
  // which is auto-selected and shown read-only instead of as a picker. If
  // the site has ever been used with exactly one customer (via existing
  // rates) and no customer has been picked yet, that customer is
  // auto-selected too — a convenience default that never overrides a
  // customer the user already chose, and not a new data relationship.
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
  // *any* site on that date is still a real conflict. `excludeLogId` skips
  // the record currently being edited, so re-saving it without changes
  // doesn't flag itself as a duplicate of itself.
  const findDuplicateConflicts = (employeeIds, targetDates, excludeLogId = null) => {
    const dateSet = new Set(targetDates);
    const conflicts = [];
    workLogs.forEach((log) => {
      if (excludeLogId && String(log.id) === String(excludeLogId)) return;
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
    setSelectedRanges([]);
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
    setSelectedRanges([{ start: normalizeDate(log.date), end: normalizeDate(log.date) }]);
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

    if (editingLogId && uniqueDates.length > 1) {
      alert("בעריכת רשומה ניתן לבחור תאריך אחד בלבד.");
      return;
    }

    const datesToUse = editingLogId ? uniqueDates.slice(0, 1) : uniqueDates;

    const conflicts = findDuplicateConflicts(selectedEmployees, datesToUse, editingLogId);
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
      rows.sort((a, b) => a.date.localeCompare(b.date) || a.employeeName.localeCompare(b.employeeName));
      setDuplicateConflict(rows);
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

      for (const logDate of datesToUse) {
        // eslint-disable-next-line no-await-in-loop
        await addItem("workLogs", {
          date: logDate,
          employeeIds: selectedEmployees,
          buildingIds: selectedBuildings,
          siteId,
          customerId,
          notes: notes.trim(),
        });
      }

      setSelectedEmployees([]);
      setSelectedBuildings([]);
      setNotes("");

      if (datesToUse.length > 1) {
        alert(`נוספו ${datesToUse.length} רשומות עבודה, אחת לכל יום בטווח.`);
      }
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

  const recordsCount = editingLogId ? Math.min(uniqueDates.length, 1) : uniqueDates.length;

  return (
    <>
      <div className="card">
        <h3>{editingLogId ? "עריכת רשומת עבודה" : "רישום עבודה"}</h3>

        <div className="form-section">
          <h4 className="form-section-title">מיקום העבודה</h4>
          <div className="filter-grid filter-grid-2">
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
              {siteId &&
                (hasSingleBuilding ? (
                  <>
                    <label>מבנה</label>
                    <p className="readonly-value">{allSiteBuildings[0].name}</p>
                  </>
                ) : (
                  <div className="buildings-section">
                    <div className="section-title-row">
                      <label>מבנים</label>
                      <div className="building-actions">
                        <button
                          type="button"
                          className="secondary-btn"
                          onClick={selectAllBuildings}
                        >
                          בחר הכל
                        </button>
                        <button
                          type="button"
                          className="secondary-btn"
                          onClick={() => setSelectedBuildings([])}
                        >
                          נקה הכל
                        </button>
                      </div>
                    </div>

                    <input
                      type="text"
                      placeholder="🔍 חפש מבנה..."
                      value={buildingSearch}
                      onChange={(e) => setBuildingSearch(e.target.value)}
                    />

                    <div className="checkbox-list">
                      {siteBuildings.length === 0 ? (
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
                  </div>
                ))}
            </div>
          </div>
        </div>

        <hr className="form-divider" />

        <div className="form-section">
          <h4 className="form-section-title">בחירת כוח אדם</h4>
          <div className="employee-actions">
            <button
              type="button"
              className={group === "" ? "primary-btn" : "secondary-btn"}
              onClick={() => changeWorkforceType("")}
            >
              כל העובדים
            </button>
            <button
              type="button"
              className={group === "internal" ? "primary-btn" : "secondary-btn"}
              onClick={() => changeWorkforceType("internal")}
            >
              העובדים שלי
            </button>
            <button
              type="button"
              className={group === "all-subcontractors" ? "primary-btn" : "secondary-btn"}
              onClick={() => changeWorkforceType("all-subcontractors")}
            >
              עובדי קבלן
            </button>
          </div>

          {group === "all-subcontractors" ? (
            <div
              className="filter-grid filter-grid-3 worklog-workforce-grid"
              style={{ marginTop: 14 }}
            >
              <div className="filter-grid-item">
                <SelectionPanel
                  title="בחירת קבלן"
                  search={contractorSearch}
                  onSearchChange={setContractorSearch}
                  searchPlaceholder="🔍 חפש קבלן..."
                  items={relevantContractors.map((s) => ({ id: s.id, label: s.name }))}
                  selectedIds={selectedContractorIds}
                  onToggle={toggleContractor}
                  onSelectAll={selectAllContractors}
                  onClearAll={clearAllContractors}
                  emptyMessage="אין קבלני משנה עם עובדים"
                />
              </div>

              <div className="filter-grid-item">
                {selectedContractorIds.length === 0 ? (
                  <>
                    <label>
                      בחירת עובדי הקבלן
                      <span className="required-mark"> *</span>
                    </label>
                    <div className="empty-message">יש לבחור קבלן תחילה</div>
                  </>
                ) : (
                  <SelectionPanel
                    title="בחירת עובדי הקבלן"
                    required
                    search={employeeSearch}
                    onSearchChange={setEmployeeSearch}
                    searchPlaceholder="🔍 חפש עובד..."
                    items={employeeOptions.map((e) => ({
                      id: e.id,
                      label: `${e.name} - ${getEmployeeAffiliationName(data, e)}`,
                    }))}
                    selectedIds={selectedEmployees}
                    onToggle={toggleEmployee}
                    onSelectAll={selectAllEmployees}
                    onClearAll={() => setSelectedEmployees([])}
                    emptyMessage="אין עובדים תואמים"
                  />
                )}
              </div>

              <div className="filter-grid-item">
                <SelectedItemsPanel
                  title="עובדים שנבחרו"
                  items={selectedEmployeeItems}
                  onRemove={toggleEmployee}
                  onClearAll={() => setSelectedEmployees([])}
                  emptyMessage="טרם נבחרו עובדים"
                />
              </div>
            </div>
          ) : (
            <div
              className="filter-grid filter-grid-2 worklog-workforce-grid"
              style={{ marginTop: 14 }}
            >
              <div className="filter-grid-item">
                <SelectionPanel
                  title="בחירת עובדים"
                  required
                  search={employeeSearch}
                  onSearchChange={setEmployeeSearch}
                  searchPlaceholder="🔍 חפש עובד..."
                  items={employeeOptions.map((e) => ({
                    id: e.id,
                    label: `${e.name} - ${getEmployeeAffiliationName(data, e)}`,
                  }))}
                  selectedIds={selectedEmployees}
                  onToggle={toggleEmployee}
                  onSelectAll={selectAllEmployees}
                  onClearAll={() => setSelectedEmployees([])}
                  emptyMessage="אין עובדים תואמים"
                />
              </div>

              <div className="filter-grid-item">
                <SelectedItemsPanel
                  title="עובדים שנבחרו"
                  items={selectedEmployeeItems}
                  onRemove={toggleEmployee}
                  onClearAll={() => setSelectedEmployees([])}
                  emptyMessage="טרם נבחרו עובדים"
                />
              </div>
            </div>
          )}
        </div>

        <hr className="form-divider" />

        <div className="form-section">
          <h4 className="form-section-title">סיכום והוספה</h4>

          <div className="worklog-final-grid">
            <div className="worklog-summary-panel">
              <h5>סיכום הרשומה</h5>
              <div className="worklog-stat-cards">
                <div className="worklog-stat-card">
                  <span className="worklog-stat-value">{uniqueDates.length}</span>
                  <span className="worklog-stat-label">ימי עבודה</span>
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
                <span className="worklog-summary-label">מבנה</span>
                <span>{buildingNamesText || "לא נבחר"}</span>
              </div>
              <p className="worklog-summary-highlight">ייווצרו {recordsCount} רשומות</p>
            </div>

            <div className="worklog-notes-panel">
              <label>הערות</label>
              <textarea
                className="worklog-compact-textarea"
                placeholder="אופציונלי"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              ></textarea>
            </div>
          </div>

          <div className="employee-actions">
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
            <table className="worklog-recent-table">
              <thead>
                <tr>
                  <th>תאריך</th>
                  <th>עובדים</th>
                  <th>אתר</th>
                  <th>מבנה</th>
                  <th>מזמין</th>
                  <th className="actions-column">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {recentWorkLogs.map((log) => (
                  <tr key={log.id}>
                    <td dir="ltr">{formatExcelDate(log.date)}</td>
                    <td>{getEmployeeNames(data, log)}</td>
                    <td>{getName(sites, log.siteId)}</td>
                    <td>{getBuildingNames(data, log)}</td>
                    <td>{getName(customers, log.customerId)}</td>
                    <td>
                      <div className="report-row-actions">
                        <button className="edit-btn" type="button" onClick={() => startEdit(log)}>
                          עריכה
                        </button>
                        <button
                          className="delete-btn"
                          type="button"
                          onClick={() => {
                            if (confirm("למחוק את הרשומה?")) {
                              deleteItem("workLogs", log.id);
                            }
                          }}
                        >
                          מחיקה
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="worklog-recent-cards">
              {recentWorkLogs.map((log) => (
                <div className="worklog-recent-card" key={log.id}>
                  <div className="worklog-recent-card-row">
                    <span className="worklog-summary-label">תאריך</span>
                    <span dir="ltr">{formatExcelDate(log.date)}</span>
                  </div>
                  <div className="worklog-recent-card-row">
                    <span className="worklog-summary-label">עובדים</span>
                    <span>{getEmployeeNames(data, log)}</span>
                  </div>
                  <div className="worklog-recent-card-row">
                    <span className="worklog-summary-label">אתר</span>
                    <span>{getName(sites, log.siteId)}</span>
                  </div>
                  <div className="worklog-recent-card-row">
                    <span className="worklog-summary-label">מבנה</span>
                    <span>{getBuildingNames(data, log)}</span>
                  </div>
                  <div className="worklog-recent-card-row">
                    <span className="worklog-summary-label">מזמין</span>
                    <span>{getName(customers, log.customerId)}</span>
                  </div>
                  <div className="report-row-actions" style={{ marginTop: 10 }}>
                    <button className="edit-btn" type="button" onClick={() => startEdit(log)}>
                      עריכה
                    </button>
                    <button
                      className="delete-btn"
                      type="button"
                      onClick={() => {
                        if (confirm("למחוק את הרשומה?")) {
                          deleteItem("workLogs", log.id);
                        }
                      }}
                    >
                      מחיקה
                    </button>
                  </div>
                </div>
              ))}
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
    </>
  );
}
