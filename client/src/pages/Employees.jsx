import { useState } from "react";
import { useData } from "../state/DataProvider.jsx";
import { activeOnly } from "../lib/entities.js";
import EditEmployeeModal from "../components/EditEmployeeModal.jsx";
import EditSimpleItemModal from "../components/EditSimpleItemModal.jsx";
import ActionsLegend from "../components/ActionsLegend.jsx";

function EmployeeTable({ employees, onEdit, onDelete, onToggleArchive }) {
  return (
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>שם עובד</th>
          <th>סטטוס</th>
          <th className="actions-column">פעולות</th>
        </tr>
      </thead>
      <tbody>
        {employees.map((employee, index) => (
          <tr key={employee.id}>
            <td>{index + 1}</td>
            <td>{employee.name}</td>
            <td>{employee.archived ? "בארכיון" : "פעיל"}</td>
            <td>
              <div className="report-row-actions">
                <button className="edit-btn" type="button" onClick={() => onEdit(employee)}>
                  ערוך
                </button>
                <button className="delete-btn" type="button" onClick={() => onDelete(employee)}>
                  מחק
                </button>
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
  );
}

export default function Employees() {
  const { data, addItem, updateItem, deleteItem } = useData();
  const { employees, subcontractors } = data;

  const [name, setName] = useState("");
  const [type, setType] = useState("internal");
  const [subcontractorId, setSubcontractorId] = useState("");
  const [subName, setSubName] = useState("");
  const [showArchived, setShowArchived] = useState(false);
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

  const deleteEmployee = async (employee) => {
    if (
      !confirm(
        `למחוק את ${employee.name} לצמיתות? בשונה מהעברה לארכיון, מחיקה תשפיע גם על דוחות והיסטוריה שכבר נרשמו עם העובד הזה.`
      )
    ) {
      return;
    }
    await deleteItem("employees", employee.id);
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

  const deleteSubcontractor = async (subcontractor) => {
    const subEmployees = subcontractorEmployeesOf(subcontractor);
    const employeeNote =
      subEmployees.length > 0 ? ` וכל ${subEmployees.length} העובדים שלו` : "";
    if (
      !confirm(
        `למחוק את ${subcontractor.name}${employeeNote} לצמיתות? בשונה מהעברה לארכיון, מחיקה תשפיע גם על דוחות והיסטוריה שכבר נרשמו.`
      )
    ) {
      return;
    }
    for (const employee of subEmployees) {
      // eslint-disable-next-line no-await-in-loop
      await deleteItem("employees", employee.id);
    }
    await deleteItem("subcontractors", subcontractor.id);
  };

  const unassignedSubEmployees = subcontractorEmployees.filter(
    (e) => !e.subcontractorId
  );

  return (
    <>
      <div className="card" style={{ marginTop: 20 }}>
        <h3>הוספת עובד</h3>

        <label>שם עובד</label>
        <input
          placeholder="שם עובד"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <label>שיוך עובד</label>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="internal">עובד שלי</option>
          <option value="subcontractor">עובד קבלן משנה</option>
        </select>

        {type === "subcontractor" && (
          <div>
            <label>קבלן משנה</label>
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
              <p>עדיין אין קבלני משנה. הוסף קודם קבלן משנה באזור הבא.</p>
            )}
          </div>
        )}

        <button
          className="primary-btn"
          type="button"
          onClick={addEmployee}
          disabled={isAddingEmployee}
        >
          {isAddingEmployee ? "מוסיף..." : "הוסף עובד"}
        </button>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h3>הוספת קבלן משנה</h3>
        <label>שם קבלן משנה</label>
        <input
          placeholder="שם קבלן המשנה"
          value={subName}
          onChange={(e) => setSubName(e.target.value)}
        />
        <button
          className="primary-btn"
          type="button"
          onClick={addSubcontractor}
          disabled={isAddingSubcontractor}
        >
          {isAddingSubcontractor ? "מוסיף..." : "הוסף קבלן משנה"}
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
        <h3>העובדים שלי - סה״כ {internalEmployees.length}</h3>
        {internalEmployees.length === 0 ? (
          <p>אין עדיין עובדים שלי.</p>
        ) : (
          <EmployeeTable
            employees={internalEmployees}
            onEdit={setEditingEmployee}
            onDelete={deleteEmployee}
            onToggleArchive={toggleEmployeeArchive}
          />
        )}
      </div>

      {visibleSubcontractors.map((subcontractor) => {
        const list = subcontractorEmployees.filter(
          (e) => String(e.subcontractorId || "") === String(subcontractor.id)
        );
        return (
          <div className="card" style={{ marginTop: 20 }} key={subcontractor.id}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <h3>
                {subcontractor.name}
                {subcontractor.archived ? " (בארכיון)" : ""} - סה״כ {list.length}
              </h3>
              <div className="report-row-actions">
                <button
                  className="edit-btn"
                  type="button"
                  onClick={() => setEditingSubcontractor(subcontractor)}
                >
                  ערוך קבלן
                </button>
                <button
                  className="delete-btn"
                  type="button"
                  onClick={() => deleteSubcontractor(subcontractor)}
                >
                  מחק קבלן
                </button>
                <button
                  className="archive-btn"
                  type="button"
                  onClick={() => toggleSubcontractorArchive(subcontractor)}
                >
                  {subcontractor.archived ? "שחזר קבלן" : "ארכיון"}
                </button>
              </div>
            </div>
            {list.length === 0 ? (
              <p>אין עובדים המשויכים לקבלן הזה.</p>
            ) : (
              <EmployeeTable
                employees={list}
                onEdit={setEditingEmployee}
                onDelete={deleteEmployee}
                onToggleArchive={toggleEmployeeArchive}
              />
            )}
          </div>
        );
      })}

      {unassignedSubEmployees.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <h3>עובדי קבלן שלא שויכו לקבלן</h3>
          <EmployeeTable
            employees={unassignedSubEmployees}
            onEdit={setEditingEmployee}
            onDelete={deleteEmployee}
            onToggleArchive={toggleEmployeeArchive}
          />
        </div>
      )}

      <div className="card" style={{ marginTop: 20 }}>
        <h3>סיכום עובדים</h3>
        <p>
          עובדים שלי: <strong>{internalEmployees.length}</strong>
        </p>
        <p>
          עובדי קבלני משנה: <strong>{subcontractorEmployees.length}</strong>
        </p>
        <p>
          סה״כ עובדים כללי: <strong>{internalEmployees.length + subcontractorEmployees.length}</strong>
        </p>
      </div>

      <ActionsLegend />

      {editingEmployee && (
        <EditEmployeeModal
          employee={editingEmployee}
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
