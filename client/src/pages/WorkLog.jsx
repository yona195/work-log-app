import { useMemo, useState } from "react";
import { useData } from "../state/DataProvider.jsx";
import { normalizeDate, todayISO } from "../lib/format.js";
import {
  getName,
  getEmployeeNames,
  getBuildingNames,
  activeOnly,
} from "../lib/entities.js";

export default function WorkLog() {
  const { data, addItem, deleteItem } = useData();
  const { subcontractors, sites, buildings, customers, workLogs } = data;
  // Pickers for a NEW entry must exclude archived records; the existing-logs
  // table below still needs the full (unfiltered) lists so it can keep
  // resolving names for entries that reference an already-archived record.
  const employees = activeOnly(data.employees);
  const pickableSites = activeOnly(sites);
  const pickableCustomers = activeOnly(customers);

  const [date, setDate] = useState(todayISO());
  const [group, setGroup] = useState("");
  const [search, setSearch] = useState("");
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [siteId, setSiteId] = useState("");
  const [buildingSearch, setBuildingSearch] = useState("");
  const [selectedBuildings, setSelectedBuildings] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [notes, setNotes] = useState("");

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

  const add = async () => {
    if (
      !date ||
      selectedEmployees.length === 0 ||
      !siteId ||
      selectedBuildings.length === 0 ||
      !customerId
    ) {
      alert("נא למלא תאריך, עובד, אתר, מבנה ומזמין");
      return;
    }

    await addItem("workLogs", {
      date,
      employeeIds: selectedEmployees,
      buildingIds: selectedBuildings,
      siteId,
      customerId,
      notes: notes.trim(),
    });

    setSelectedEmployees([]);
    setSelectedBuildings([]);
    setNotes("");
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

        <label>תאריך</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />

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

        <button className="primary-btn" type="button" onClick={add}>
          הוסף ליומן
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
                <th>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {sortedWorkLogs.map((log) => (
                <tr key={log.id}>
                  <td>{normalizeDate(log.date)}</td>
                  <td>{getEmployeeNames(data, log)}</td>
                  <td>{(log.employeeIds || []).length || log.employeeCount || 1}</td>
                  <td>{getName(sites, log.siteId)}</td>
                  <td>{getBuildingNames(data, log)}</td>
                  <td>{getName(customers, log.customerId)}</td>
                  <td>{log.notes || ""}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("למחוק את הרשומה?")) {
                          deleteItem("workLogs", log.id);
                        }
                      }}
                    >
                      מחק
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
