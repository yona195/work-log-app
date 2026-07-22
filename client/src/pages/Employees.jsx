import { useMemo, useState } from "react";
import { useData } from "../state/DataProvider.jsx";
import { activeOnly, getEmployeeIds } from "../lib/entities.js";
import EditSimpleItemModal from "../components/EditSimpleItemModal.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import GroupCard from "../components/GroupCard.jsx";
import CompactRow from "../components/CompactRow.jsx";
import Pagination, { usePagedList } from "../components/Pagination.jsx";
import { useBulkSelection } from "../components/useBulkSelection.js";

const matchesSearch = (text, value) => {
  if (!text) return true;
  return String(value || "").toLowerCase().includes(text);
};

// Paginates itself — this renders once for the legacy "unassigned" bucket,
// so it gets its own independent page state for free with no extra wiring
// in the parent. `selectedIds`/`toggleSelect`/`isFullySelected`/`toggleAll`
// come from the parent's single shared useBulkSelection instance, so this
// table's selection lives in the exact same array as every other section's
// — a bulk archive/delete triggered from the page header covers rows here
// too, and this table's own header checkbox is just isFullySelected/
// toggleAll scoped to its current page.
function EmployeeTable({
  employees,
  onEdit,
  onDelete,
  onToggleArchive,
  selectedIds,
  toggleSelect,
  isFullySelected,
  toggleAll,
  advancedModeEnabled,
}) {
  const { pageItems, page, setPage, totalPages, startIndex } = usePagedList(employees);
  return (
    <>
      <table>
        <thead>
          <tr>
            <th className="select-column">
              <input
                type="checkbox"
                checked={isFullySelected(pageItems)}
                onChange={() => toggleAll(pageItems)}
                aria-label="בחר הכל בעמוד זה"
              />
            </th>
            <th>#</th>
            <th>שם עובד</th>
            <th>סטטוס</th>
            <th className="actions-column">פעולות</th>
          </tr>
        </thead>
        <tbody>
          {pageItems.map((employee, index) => (
            <tr key={employee.id}>
              <td className="select-column">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(employee.id)}
                  onChange={() => toggleSelect(employee.id)}
                />
              </td>
              <td>{startIndex + index + 1}</td>
              <td>{employee.name}</td>
              <td><StatusBadge archived={employee.archived} /></td>
              <td>
                <div className="report-row-actions">
                  <button className="edit-btn" type="button" onClick={() => onEdit(employee)}>
                    ערוך
                  </button>
                  {advancedModeEnabled && (
                    <button className="delete-btn" type="button" onClick={() => onDelete(employee)}>
                      מחק
                    </button>
                  )}
                  <button
                    className="archive-btn"
                    type="button"
                    onClick={() => onToggleArchive(employee)}
                  >
                    {employee.archived ? "שחזר" : "ארכיון"}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pagination page={page} totalPages={totalPages} onChange={setPage} />
    </>
  );
}

export default function Employees() {
  const { data, addItem, updateItem, deleteItem } = useData();
  const { employees, subcontractors, rates, workLogs } = data;

  const [name, setName] = useState("");
  const [type, setType] = useState("internal");
  const [subcontractorId, setSubcontractorId] = useState("");
  const [subName, setSubName] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [isAddingEmployee, setIsAddingEmployee] = useState(false);
  const [isAddingSubcontractor, setIsAddingSubcontractor] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [editingSubcontractor, setEditingSubcontractor] = useState(null);

  const visibleEmployees = showArchived ? employees : activeOnly(employees);
  const visibleSubcontractors = showArchived
    ? subcontractors
    : activeOnly(subcontractors);

  const internalEmployees = visibleEmployees.filter((e) => e.type === "internal");
  const subcontractorEmployees = visibleEmployees.filter(
    (e) => e.type === "subcontractor" || e.type === "external"
  );

  const search = searchText.trim().toLowerCase();

  const filteredInternalEmployees = useMemo(
    () => internalEmployees.filter((e) => matchesSearch(search, e.name)),
    [internalEmployees, search]
  );

  // Includes both truly-unassigned employees (no subcontractorId) and
  // orphaned ones (subcontractorId points at a subcontractor that no longer
  // exists, e.g. from before cascading delete was added) — either way,
  // there's no subcontractor card left to render them under otherwise,
  // which made them invisible on this page.
  const existingSubcontractorIds = new Set(subcontractors.map((s) => String(s.id)));
  const unassignedSubEmployees = subcontractorEmployees
    .filter((e) => !e.subcontractorId || !existingSubcontractorIds.has(String(e.subcontractorId)))
    .filter((e) => matchesSearch(search, e.name));

  // A contractor stays visible while searching if its own name matches, or
  // any of its employees' names do; if it's the contractor's own name that
  // matched, its full roster is shown (the user searched for the
  // contractor itself), otherwise only the matching employees are shown.
  const contractorCards = useMemo(() => {
    return visibleSubcontractors
      .map((subcontractor) => {
        const list = subcontractorEmployees.filter(
          (e) => String(e.subcontractorId || "") === String(subcontractor.id)
        );
        const nameMatches = matchesSearch(search, subcontractor.name);
        const filteredList = !search || nameMatches
          ? list
          : list.filter((e) => matchesSearch(search, e.name));
        return { subcontractor, list, filteredList, nameMatches };
      })
      .filter(({ list, nameMatches }) => !search || nameMatches || list.some((e) => matchesSearch(search, e.name)));
  }, [visibleSubcontractors, subcontractorEmployees, search]);

  // Every employee currently rendered anywhere on the page (own card,
  // under a contractor's card, or the unassigned bucket) — used to prune
  // stale selection ids and as the target of the page-level "בחר הכל".
  const allVisibleEmployees = useMemo(
    () => [
      ...filteredInternalEmployees,
      ...contractorCards.flatMap((c) => c.filteredList),
      ...unassignedSubEmployees,
    ],
    [filteredInternalEmployees, contractorCards, unassignedSubEmployees]
  );

  const {
    selectedIds: selectedEmployeeIds,
    toggle: toggleEmployeeSelection,
    isFullySelected: isEmployeeGroupFullySelected,
    toggleAll: toggleAllEmployees,
    clear: clearEmployeeSelection,
  } = useBulkSelection(allVisibleEmployees);

  const isAllVisibleEmployeesSelected = isEmployeeGroupFullySelected(allVisibleEmployees);
  const toggleSelectAllVisibleEmployees = () => toggleAllEmployees(allVisibleEmployees);

  // Every delete button on this page (row/group/bulk) is hidden until this
  // is checked — "ארכיון"/"ערוך" stay visible either way, since only delete
  // is dangerous enough to need a second, explicit door.
  const [advancedModeEnabled, setAdvancedModeEnabled] = useState(false);

  const employeeNameValid = name.trim().length > 0;
  const contractorSelectionRequired = type === "subcontractor";
  const contractorSelectionValid = !contractorSelectionRequired || Boolean(subcontractorId);
  const canAddEmployee = employeeNameValid && contractorSelectionValid && !isAddingEmployee;
  const canAddSubcontractor = subName.trim().length > 0 && !isAddingSubcontractor;

  const addEmployee = async () => {
    if (isAddingEmployee) return;
    const trimmed = name.trim();
    if (!trimmed) {
      alert("נא להזין שם עובד");
      return;
    }
    if (type === "subcontractor" && !subcontractorId) {
      alert("נא לבחור קבלן משנה");
      return;
    }
    setIsAddingEmployee(true);
    try {
      await addItem("employees", {
        name: trimmed,
        type,
        subcontractorId: type === "subcontractor" ? subcontractorId : "",
      });
      setName("");
      setSubcontractorId("");
      setType("internal");
    } finally {
      setIsAddingEmployee(false);
    }
  };

  const addSubcontractor = async () => {
    if (isAddingSubcontractor) return;
    const trimmed = subName.trim();
    if (!trimmed) {
      alert("נא להזין שם קבלן משנה");
      return;
    }
    setIsAddingSubcontractor(true);
    try {
      await addItem("subcontractors", { name: trimmed });
      setSubName("");
    } finally {
      setIsAddingSubcontractor(false);
    }
  };

  const toggleEmployeeArchive = async (employee) => {
    if (employee.archived) {
      await updateItem("employees", employee.id, { archived: false });
      return;
    }
    if (
      !confirm(
        `להעביר את ${employee.name} לארכיון? העובד לא יופיע יותר לבחירה ברשומות חדשות, אבל הדוחות הקיימים לא ישתנו.`
      )
    ) {
      return;
    }
    await updateItem("employees", employee.id, { archived: true });
  };

  // Rates/work-logs a single employee's deletion would affect — a rate is
  // always deleted outright (it's theirs alone); a work-log/history record
  // is deleted outright only if this employee is its sole participant,
  // otherwise just has them removed from it (same rule already used for
  // the employee-filtered delete in WorkHistory.jsx).
  const employeeDependents = (employee) => {
    const employeeRates = rates.filter(
      (r) => r.rateType === "employee" && String(r.employeeId) === String(employee.id)
    );
    const employeeLogs = workLogs.filter((log) =>
      getEmployeeIds(log).map(String).includes(String(employee.id))
    );
    return { employeeRates, employeeLogs };
  };

  // Applies the cascade for one employee: deletes their rates, and for
  // each work log they appear in either removes just them (other
  // participants stay, along with the date/site/customer) or deletes the
  // whole record if they were its only participant. `logState` is a
  // shared, mutable {logId -> current employeeIds} map so that when
  // several of the same subcontractor's employees are deleted together in
  // one pass, each one sees the previous ones' already-applied removals
  // instead of working off a now-stale snapshot.
  const cascadeDeleteEmployeeDependents = async (employee, logState) => {
    const { employeeRates } = employeeDependents(employee);
    for (const rate of employeeRates) {
      // eslint-disable-next-line no-await-in-loop
      await deleteItem("rates", rate.id);
    }

    for (const [logId, currentIds] of logState.entries()) {
      if (!currentIds.includes(String(employee.id))) continue;
      const remainingIds = currentIds.filter((id) => id !== String(employee.id));
      if (remainingIds.length === 0) {
        // eslint-disable-next-line no-await-in-loop
        await deleteItem("workLogs", logId);
        logState.delete(logId);
      } else {
        // eslint-disable-next-line no-await-in-loop
        await updateItem("workLogs", logId, { employeeIds: remainingIds });
        logState.set(logId, remainingIds);
      }
    }
  };

  const deleteEmployee = async (employee) => {
    const { employeeRates, employeeLogs } = employeeDependents(employee);
    const cascadeParts = [];
    if (employeeRates.length > 0) cascadeParts.push(`${employeeRates.length} תעריפים`);
    if (employeeLogs.length > 0) cascadeParts.push(`${employeeLogs.length} רשומות עבודה`);
    const cascadeNote =
      cascadeParts.length > 0
        ? ` יושפעו ${cascadeParts.join(", ")} - רשומות עם עובדים נוספים יישארו, ורק ${employee.name} יוסר מהן.`
        : "";

    if (
      !confirm(
        `למחוק את ${employee.name} לצמיתות?${cascadeNote} בשונה מהעברה לארכיון, מחיקה תשפיע גם על דוחות והיסטוריה שכבר נרשמו עם העובד הזה.`
      )
    ) {
      return;
    }
    const logState = new Map(workLogs.map((log) => [log.id, getEmployeeIds(log).map(String)]));
    await cascadeDeleteEmployeeDependents(employee, logState);
    await deleteItem("employees", employee.id);
  };

  const bulkArchiveSelectedEmployees = async () => {
    if (
      !confirm(
        `להעביר את ${selectedEmployeeIds.length} העובדים שנבחרו לארכיון? העובדים לא יופיעו יותר לבחירה ברשומות חדשות, אבל הדוחות הקיימים לא ישתנו.`
      )
    ) {
      return;
    }
    for (const id of selectedEmployeeIds) {
      // eslint-disable-next-line no-await-in-loop
      await updateItem("employees", id, { archived: true });
    }
    clearEmployeeSelection();
  };

  // Reuses the same cascade as a single-employee delete, just applied to
  // every selected employee in turn with one shared logState so several
  // selections that touch the same work log see each other's removals.
  const bulkDeleteSelectedEmployees = async () => {
    if (
      !confirm(
        `למחוק ${selectedEmployeeIds.length} עובדים שנבחרו לצמיתות? בשונה מהעברה לארכיון, מחיקה תשפיע גם על דוחות והיסטוריה שכבר נרשמו איתם.`
      )
    ) {
      return;
    }
    const logState = new Map(workLogs.map((log) => [log.id, getEmployeeIds(log).map(String)]));
    for (const id of selectedEmployeeIds) {
      const employee = employees.find((e) => String(e.id) === String(id));
      if (!employee) continue;
      // eslint-disable-next-line no-await-in-loop
      await cascadeDeleteEmployeeDependents(employee, logState);
      // eslint-disable-next-line no-await-in-loop
      await deleteItem("employees", id);
    }
    clearEmployeeSelection();
  };

  // Actions on a subcontractor cascade to its own employees (archive/
  // restore/delete all move together), but the reverse never happens —
  // touching one employee must never affect their subcontractor or
  // siblings.
  const subcontractorEmployeesOf = (subcontractor) =>
    employees.filter(
      (e) => String(e.subcontractorId || "") === String(subcontractor.id)
    );

  const toggleSubcontractorArchive = async (subcontractor) => {
    const subEmployees = subcontractorEmployeesOf(subcontractor);
    if (subcontractor.archived) {
      await updateItem("subcontractors", subcontractor.id, { archived: false });
      for (const employee of subEmployees) {
        // eslint-disable-next-line no-await-in-loop
        await updateItem("employees", employee.id, { archived: false });
      }
      return;
    }
    const employeeNote =
      subEmployees.length > 0 ? ` וכל ${subEmployees.length} העובדים שלו` : "";
    if (
      !confirm(
        `להעביר את ${subcontractor.name}${employeeNote} לארכיון? לא יופיעו יותר לבחירה ברשומות חדשות, אבל הדוחות הקיימים לא ישתנו.`
      )
    ) {
      return;
    }
    await updateItem("subcontractors", subcontractor.id, { archived: true });
    for (const employee of subEmployees) {
      // eslint-disable-next-line no-await-in-loop
      await updateItem("employees", employee.id, { archived: true });
    }
  };

  // A subcontractor-level "general" rate (legacy rateType, points at the
  // subcontractor directly rather than one of its employees) belongs to
  // the subcontractor itself, not to any one employee — it doesn't get
  // caught by cascadeDeleteEmployeeDependents below, so it's cleared here.
  const subcontractorGeneralRates = (subcontractor) =>
    rates.filter(
      (r) => r.rateType !== "employee" && String(r.subcontractorId || "") === String(subcontractor.id)
    );

  const deleteSubcontractor = async (subcontractor) => {
    const subEmployees = subcontractorEmployeesOf(subcontractor);
    const generalRates = subcontractorGeneralRates(subcontractor);
    const employeeNote =
      subEmployees.length > 0 ? ` וכל ${subEmployees.length} העובדים שלו` : "";
    if (
      !confirm(
        `למחוק את ${subcontractor.name}${employeeNote} לצמיתות? בשונה מהעברה לארכיון, מחיקה תשפיע גם על דוחות והיסטוריה שכבר נרשמו (תעריפים, רישום עבודה והיסטוריה של כל עובדיו).`
      )
    ) {
      return;
    }
    for (const rate of generalRates) {
      // eslint-disable-next-line no-await-in-loop
      await deleteItem("rates", rate.id);
    }
    const logState = new Map(workLogs.map((log) => [log.id, getEmployeeIds(log).map(String)]));
    for (const employee of subEmployees) {
      // eslint-disable-next-line no-await-in-loop
      await cascadeDeleteEmployeeDependents(employee, logState);
      // eslint-disable-next-line no-await-in-loop
      await deleteItem("employees", employee.id);
    }
    await deleteItem("subcontractors", subcontractor.id);
  };

  return (
    <>
      <div className="card">
        <div className="filter-grid filter-grid-3">
          <div className="filter-grid-item">
            <div className="employees-summary-card">
              <span className="employees-summary-value">{internalEmployees.length}</span>
              <span className="employees-summary-label">העובדים שלי</span>
            </div>
          </div>
          <div className="filter-grid-item">
            <div className="employees-summary-card">
              <span className="employees-summary-value">{subcontractorEmployees.length}</span>
              <span className="employees-summary-label">עובדי קבלני משנה</span>
            </div>
          </div>
          <div className="filter-grid-item">
            <div className="employees-summary-card">
              <span className="employees-summary-value">
                {internalEmployees.length + subcontractorEmployees.length}
              </span>
              <span className="employees-summary-label">סה״כ עובדים</span>
            </div>
          </div>
        </div>
      </div>

      <div className="filter-grid filter-grid-2" style={{ marginTop: 20 }}>
        <div className="filter-grid-item">
          <div className="card" style={{ height: "100%" }}>
            <h3>הוספת עובד</h3>

            <label>שם עובד</label>
            <input
              placeholder="שם עובד"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <div className="employees-form-fields">
              <div>
                <label>שיוך עובד</label>
                <div className="employee-actions">
                  <button
                    type="button"
                    className={type === "internal" ? "primary-btn" : "secondary-btn"}
                    onClick={() => {
                      setType("internal");
                      setSubcontractorId("");
                    }}
                  >
                    עובד שלי
                  </button>
                  <button
                    type="button"
                    className={type === "subcontractor" ? "primary-btn" : "secondary-btn"}
                    onClick={() => setType("subcontractor")}
                  >
                    עובד קבלן
                  </button>
                </div>
              </div>

              {type === "subcontractor" && (
                <div>
                  <label>
                    קבלן משנה
                    <span className="required-mark"> *</span>
                  </label>
                  <select
                    value={subcontractorId}
                    onChange={(e) => setSubcontractorId(e.target.value)}
                  >
                    <option value="">בחר קבלן משנה</option>
                    {activeOnly(subcontractors).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  {activeOnly(subcontractors).length === 0 && (
                    <p className="field-error">עדיין אין קבלני משנה. הוסף קודם קבלן משנה בכרטיס הסמוך.</p>
                  )}
                </div>
              )}

              <div className="employees-submit-row">
                <button
                  className="primary-btn employees-submit-btn"
                  type="button"
                  onClick={addEmployee}
                  disabled={!canAddEmployee}
                >
                  {isAddingEmployee ? "מוסיף..." : "הוסף עובד"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="filter-grid-item">
          <div className="card" style={{ height: "100%" }}>
            <h3>הוספת קבלן משנה</h3>
            <label>שם קבלן משנה</label>
            <input
              placeholder="שם קבלן המשנה"
              value={subName}
              onChange={(e) => setSubName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addSubcontractor()}
            />
            <button
              className="primary-btn"
              type="button"
              onClick={addSubcontractor}
              disabled={!canAddSubcontractor}
            >
              {isAddingSubcontractor ? "מוסיף..." : "הוסף קבלן משנה"}
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="employees-toolbar">
          <input
            type="text"
            className="employees-search-input"
            placeholder="חפש עובד או קבלן..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <label className="checkbox-item" style={{ display: "inline-flex" }}>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            <span>הצג פריטים בארכיון</span>
          </label>
        </div>

        {allVisibleEmployees.length > 0 && (
          <div className="bulk-select-row">
            <label className="checkbox-item">
              <input
                type="checkbox"
                checked={isAllVisibleEmployeesSelected}
                onChange={toggleSelectAllVisibleEmployees}
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
            {selectedEmployeeIds.length > 0 && (
              <div className="report-row-actions bulk-actions-inline">
                <button className="archive-btn" type="button" onClick={bulkArchiveSelectedEmployees}>
                  ארכיון ({selectedEmployeeIds.length})
                </button>
                {advancedModeEnabled && (
                  <button className="delete-btn" type="button" onClick={bulkDeleteSelectedEmployees}>
                    מחק ({selectedEmployeeIds.length})
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <GroupCard
          icon="badge"
          title="העובדים שלי"
          count={internalEmployees.length}
          countLabel="עובדים"
          selectionControl={
            filteredInternalEmployees.length > 0 && (
              <input
                type="checkbox"
                checked={isEmployeeGroupFullySelected(filteredInternalEmployees)}
                onChange={() => toggleAllEmployees(filteredInternalEmployees)}
                aria-label="בחר הכל - העובדים שלי"
              />
            )
          }
        >
          {filteredInternalEmployees.length === 0 ? (
            <p className="empty-message">
              {search ? "לא נמצאו עובדים שלי התואמים לחיפוש." : "אין עדיין עובדים שלי."}
            </p>
          ) : (
            <div className="employees-compact-list">
              {filteredInternalEmployees.map((employee) => (
                <CompactRow
                  key={employee.id}
                  name={employee.name}
                  archived={employee.archived}
                  selected={selectedEmployeeIds.includes(employee.id)}
                  onToggleSelect={() => toggleEmployeeSelection(employee.id)}
                  onEdit={() => setEditingEmployee(employee)}
                  onDelete={advancedModeEnabled ? () => deleteEmployee(employee) : undefined}
                  onToggleArchive={() => toggleEmployeeArchive(employee)}
                />
              ))}
            </div>
          )}
        </GroupCard>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h3>קבלני משנה</h3>
        {contractorCards.length === 0 ? (
          <p className="empty-message">
            {search ? "לא נמצאו קבלני משנה התואמים לחיפוש." : "אין עדיין קבלני משנה."}
          </p>
        ) : (
          <div className="employees-contractor-list">
            {contractorCards.map(({ subcontractor, list, filteredList }) => (
              <GroupCard
                key={subcontractor.id}
                icon="badge"
                title={subcontractor.name}
                count={list.length}
                countLabel="עובדים"
                isArchived={subcontractor.archived}
                selectionControl={
                  filteredList.length > 0 && (
                    <input
                      type="checkbox"
                      checked={isEmployeeGroupFullySelected(filteredList)}
                      onChange={() => toggleAllEmployees(filteredList)}
                      aria-label={`בחר הכל - ${subcontractor.name}`}
                    />
                  )
                }
                groupActions={
                  <div className="report-row-actions">
                    <button
                      className="edit-btn"
                      type="button"
                      onClick={() => setEditingSubcontractor(subcontractor)}
                    >
                      ערוך קבלן
                    </button>
                    {advancedModeEnabled && (
                      <button
                        className="delete-btn"
                        type="button"
                        onClick={() => deleteSubcontractor(subcontractor)}
                      >
                        מחק קבלן
                      </button>
                    )}
                    <button
                      className="archive-btn"
                      type="button"
                      onClick={() => toggleSubcontractorArchive(subcontractor)}
                    >
                      {subcontractor.archived ? "שחזר" : "ארכיון"}
                    </button>
                  </div>
                }
              >
                {filteredList.length === 0 ? (
                  <p className="empty-message">
                    {list.length === 0
                      ? "אין עובדים המשויכים לקבלן הזה."
                      : "לא נמצאו עובדים התואמים לחיפוש."}
                  </p>
                ) : (
                  <div className="employees-compact-list">
                    {filteredList.map((employee) => (
                      <CompactRow
                        key={employee.id}
                        name={employee.name}
                        archived={employee.archived}
                        selected={selectedEmployeeIds.includes(employee.id)}
                        onToggleSelect={() => toggleEmployeeSelection(employee.id)}
                        onEdit={() => setEditingEmployee(employee)}
                        onDelete={advancedModeEnabled ? () => deleteEmployee(employee) : undefined}
                        onToggleArchive={() => toggleEmployeeArchive(employee)}
                      />
                    ))}
                  </div>
                )}
              </GroupCard>
            ))}
          </div>
        )}
      </div>

      {unassignedSubEmployees.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <h3>עובדי קבלן שלא שויכו לקבלן</h3>
          <EmployeeTable
            employees={unassignedSubEmployees}
            onEdit={setEditingEmployee}
            onDelete={deleteEmployee}
            onToggleArchive={toggleEmployeeArchive}
            selectedIds={selectedEmployeeIds}
            toggleSelect={toggleEmployeeSelection}
            isFullySelected={isEmployeeGroupFullySelected}
            toggleAll={toggleAllEmployees}
            advancedModeEnabled={advancedModeEnabled}
          />
        </div>
      )}

      {editingEmployee && (
        <EditSimpleItemModal
          title="עריכת עובד"
          initialName={editingEmployee.name}
          onSave={(newName) => updateItem("employees", editingEmployee.id, { name: newName })}
          onClose={() => setEditingEmployee(null)}
        />
      )}

      {editingSubcontractor && (
        <EditSimpleItemModal
          title="עריכת קבלן משנה"
          initialName={editingSubcontractor.name}
          onSave={(newName) =>
            updateItem("subcontractors", editingSubcontractor.id, { name: newName })
          }
          onClose={() => setEditingSubcontractor(null)}
        />
      )}
    </>
  );
}
