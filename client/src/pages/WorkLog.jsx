import { useMemo, useState } from "react";
import { useData } from "../state/DataProvider.jsx";
import { normalizeDate } from "../lib/format.js";
import { isoRangeInclusive } from "../lib/calendar.js";
import {
  getName,
  getEmployeeIds,
  getEmployeeNames,
  getBuildingNames,
  activeOnly,
  activeEmployees,
} from "../lib/entities.js";
import DatePicker from "../components/DatePicker.jsx";
import DuplicateConflictModal from "../components/DuplicateConflictModal.jsx";
import Pagination, { usePagedList } from "../components/Pagination.jsx";

export default function WorkLog() {
  const { data, addItem, deleteItem } = useData();
  const { subcontractors, sites, buildings, customers, workLogs } = data;
  // Pickers for a NEW entry must exclude archived records; the existing-logs
  // table below still needs the full (unfiltered) lists so it can keep
  // resolving names for entries that reference an already-archived record.
  const employees = activeEmployees(data);
  const pickableSites = activeOnly(sites);
  const pickableCustomers = activeOnly(customers);

  // Multiple independent date ranges (not just one from/to), so the same
  // employees/site/building/customer can be logged for several separate
  // spans (e.g. two different work weeks) in one submit. Starts empty —
  // pre-selecting today by default meant clicking today again removed it
  // instead of starting a range from it.
  const [selectedRanges, setSelectedRanges] = useState([]);
  const [group, setGroup] = useState("");
  const [search, setSearch] = useState("");
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [siteId, setSiteId] = useState("");
  const [buildingSearch, setBuildingSearch] = useState("");
  const [selectedBuildings, setSelectedBuildings] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicateConflict, setDuplicateConflict] = useState(null);

  const visibleEmployees = useMemo(() => {
    const text = search.trim().toLowerCase();
    return employees.filter((employee) => {
      const isInternal = employee.type === "internal";
      let matchesGroup = true;
      if (group === "internal") matchesGroup = isInternal;
      else if (group === "all-subcontractors") matchesGroup = !isInternal;
      else if (group)
        matchesGroup = String(employee.subcontractorId || "") === String(group);
      const matchesSearch = !text || employee.name.toLowerCase().includes(text);
      return matchesGroup && matchesSearch;
    });
  }, [employees, group, search]);

  const siteBuildings = useMemo(() => {
    if (!siteId) return [];
    const text = buildingSearch.trim().toLowerCase();
    return activeOnly(buildings)
      .filter((b) => String(b.siteId) === String(siteId))
      .filter((b) => !text || b.name.toLowerCase().includes(text));
  }, [buildings, siteId, buildingSearch]);

  const toggle = (list, setList, id) =>
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  // Catches the same employee accidentally being logged twice on the same
  // date — matches on date only, regardless of site: an employee can't
  // really work two different sites on the same day either, so a match at
  // *any* site on that date is still a real conflict.
  const findDuplicateConflicts = (employeeIds, targetDates) => {
    const dateSet = new Set(targetDates);
    const conflicts = [];
    workLogs.forEach((log) => {
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

  const changeSite = (value) => {
    setSiteId(value);
    setSelectedBuildings([]);
    setBuildingSearch("");
  };

  const sortedWorkLogs = useMemo(
    () =>
      [...workLogs].sort((a, b) =>
        normalizeDate(b.date).localeCompare(normalizeDate(a.date))
      ),
    [workLogs]
  );

  const {
    pageItems: pagedWorkLogs,
    page: workLogsPage,
    setPage: setWorkLogsPage,
    totalPages: workLogsTotalPages,
  } = usePagedList(sortedWorkLogs);

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
      alert("נא לבחור תאריך, עובד, אתר, מבנה ומזמין");
      return;
    }

    const dateSet = new Set();
    selectedRanges.forEach((range) => {
      isoRangeInclusive(range.start, range.end).forEach((iso) => dateSet.add(iso));
    });
    const dates = Array.from(dateSet).sort();

    const conflicts = findDuplicateConflicts(selectedEmployees, dates);
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
      for (const logDate of dates) {
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

      if (dates.length > 1) {
        alert(`נוספו ${dates.length} רשומות עבודה, אחת לכל יום בטווח.`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectAllVisibleEmployees = () =>
    setSelectedEmployees((prev) => {
      const ids = visibleEmployees.map((e) => e.id);
      return Array.from(new Set([...prev, ...ids]));
    });

  const selectAllVisibleBuildings = () =>
    setSelectedBuildings((prev) => {
      const ids = siteBuildings.map((b) => b.id);
      return Array.from(new Set([...prev, ...ids]));
    });

  return (
    <>
      <div className="card">
        <h3>הוספת רשומת עבודה</h3>

        <label>תאריכים</label>
        <DatePicker mode="multi-range" value={selectedRanges} onChange={setSelectedRanges} />
        <p>אפשר לבחור כמה טווחי תאריכים נפרדים - תיפתח רשומה לכל יום בכל טווח שנבחר.</p>

        <h4>בחירת עובדים</h4>

        <label>סינון לפי שיוך</label>
        <select value={group} onChange={(e) => setGroup(e.target.value)}>
          <option value="">כל העובדים</option>
          <option value="internal">העובדים שלי</option>
          <option value="all-subcontractors">כל עובדי קבלני המשנה</option>
          {activeOnly(subcontractors).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="🔍 חפש עובד..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="employee-actions">
          <button
            type="button"
            className="secondary-btn"
            onClick={selectAllVisibleEmployees}
          >
            בחר הכל
          </button>
          <button
            type="button"
            className="secondary-btn"
            onClick={() => setSelectedEmployees([])}
          >
            נקה הכל
          </button>
        </div>

        <div className="checkbox-list">
          {visibleEmployees.length === 0 ? (
            <div className="empty-message">אין עובדים תואמים</div>
          ) : (
            visibleEmployees.map((employee) => {
              const isInternal = employee.type === "internal";
              const subName = getName(subcontractors, employee.subcontractorId);
              return (
                <label className="checkbox-item" key={employee.id}>
                  <input
                    type="checkbox"
                    checked={selectedEmployees.includes(employee.id)}
                    onChange={() =>
                      toggle(
                        selectedEmployees,
                        setSelectedEmployees,
                        employee.id
                      )
                    }
                  />
                  <span>
                    {employee.name}{" "}
                    {isInternal ? "- עובד שלי" : `- ${subName || "ללא קבלן"}`}
                  </span>
                </label>
              );
            })
          )}
        </div>

        <p id="employeeCountText">
          סה״כ עובדים שנבחרו: {selectedEmployees.length}
        </p>

        <label>אתר עבודה</label>
        <select value={siteId} onChange={(e) => changeSite(e.target.value)}>
          <option value="">בחר אתר</option>
          {pickableSites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </select>

        {siteId && (
          <div className="buildings-section">
            <div className="section-title-row">
              <label>מבנים</label>
              <div className="building-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={selectAllVisibleBuildings}
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
                      onChange={() =>
                        toggle(
                          selectedBuildings,
                          setSelectedBuildings,
                          building.id
                        )
                      }
                    />
                    <span>{building.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>
        )}

        <label>מזמין עבודה</label>
        <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
          <option value="">בחר מזמין</option>
          {pickableCustomers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>

        <label>הערות</label>
        <textarea
          placeholder="אופציונלי"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        ></textarea>

        <button
          className="primary-btn"
          type="button"
          onClick={add}
          disabled={isSubmitting}
        >
          {isSubmitting ? "מוסיף..." : "הוסף ליומן"}
        </button>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h3>רשומות יומן</h3>
        {workLogs.length === 0 ? (
          <p>אין עדיין רשומות</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>תאריך</th>
                <th>עובדים</th>
                <th>סה״כ עובדים</th>
                <th>אתר</th>
                <th>מבנה</th>
                <th>מזמין</th>
                <th>הערות</th>
                <th className="actions-column">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {pagedWorkLogs.map((log) => (
                <tr key={log.id}>
                  <td>{normalizeDate(log.date)}</td>
                  <td>{getEmployeeNames(data, log)}</td>
                  <td>{(log.employeeIds || []).length || log.employeeCount || 1}</td>
                  <td>{getName(sites, log.siteId)}</td>
                  <td>{getBuildingNames(data, log)}</td>
                  <td>{getName(customers, log.customerId)}</td>
                  <td>{log.notes || ""}</td>
                  <td>
                    <div className="report-row-actions">
                      <button
                        className="delete-btn"
                        type="button"
                        onClick={() => {
                          if (confirm("למחוק את הרשומה?")) {
                            deleteItem("workLogs", log.id);
                          }
                        }}
                      >
                        מחק
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination
          page={workLogsPage}
          totalPages={workLogsTotalPages}
          onChange={setWorkLogsPage}
        />
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
