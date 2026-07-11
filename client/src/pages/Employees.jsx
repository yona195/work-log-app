import { useState } from "react";
import { useData } from "../state/DataProvider.jsx";

function EmployeeTable({ employees, onDelete }) {
  return (
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>שם עובד</th>
          <th>פעולות</th>
        </tr>
      </thead>
      <tbody>
        {employees.map((employee, index) => (
          <tr key={employee.id}>
            <td>{index + 1}</td>
            <td>{employee.name}</td>
            <td>
              <button type="button" onClick={() => onDelete(employee.id)}>
                מחק
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Employees() {
  const { data, addItem, deleteItem } = useData();
  const { employees, subcontractors } = data;

  const [name, setName] = useState("");
  const [type, setType] = useState("internal");
  const [subcontractorId, setSubcontractorId] = useState("");
  const [subName, setSubName] = useState("");

  const internalEmployees = employees.filter((e) => e.type === "internal");
  const subcontractorEmployees = employees.filter(
    (e) => e.type === "subcontractor" || e.type === "external"
  );

  const addEmployee = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      alert("נא להזין שם עובד");
      return;
    }
    if (type === "subcontractor" && !subcontractorId) {
      alert("נא לבחור קבלן משנה");
      return;
    }
    await addItem("employees", {
      name: trimmed,
      type,
      subcontractorId: type === "subcontractor" ? subcontractorId : "",
    });
    setName("");
    setSubcontractorId("");
    setType("internal");
  };

  const addSubcontractor = async () => {
    const trimmed = subName.trim();
    if (!trimmed) {
      alert("נא להזין שם קבלן משנה");
      return;
    }
    await addItem("subcontractors", { name: trimmed });
    setSubName("");
  };

  const deleteSubcontractor = async (id) => {
    if (
      !confirm(
        "מחיקת קבלן המשנה. העובדים המשויכים אליו יישארו במערכת ללא שיוך. להמשיך?"
      )
    ) {
      return;
    }
    await deleteItem("subcontractors", id);
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
              {subcontractors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {subcontractors.length === 0 && (
              <p>עדיין אין קבלני משנה. הוסף קודם קבלן משנה באזור הבא.</p>
            )}
          </div>
        )}

        <button className="primary-btn" type="button" onClick={addEmployee}>
          הוסף עובד
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
        <button className="primary-btn" type="button" onClick={addSubcontractor}>
          הוסף קבלן משנה
        </button>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h3>העובדים שלי - סה״כ {internalEmployees.length}</h3>
        {internalEmployees.length === 0 ? (
          <p>אין עדיין עובדים שלי.</p>
        ) : (
          <EmployeeTable
            employees={internalEmployees}
            onDelete={(id) => deleteItem("employees", id)}
          />
        )}
      </div>

      {subcontractors.map((subcontractor) => {
        const list = employees.filter(
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
                {subcontractor.name} - סה״כ {list.length}
              </h3>
              <button
                type="button"
                onClick={() => deleteSubcontractor(subcontractor.id)}
              >
                מחק קבלן
              </button>
            </div>
            {list.length === 0 ? (
              <p>אין עובדים המשויכים לקבלן הזה.</p>
            ) : (
              <EmployeeTable
                employees={list}
                onDelete={(id) => deleteItem("employees", id)}
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
            onDelete={(id) => deleteItem("employees", id)}
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
          סה״כ עובדים כללי: <strong>{employees.length}</strong>
        </p>
      </div>
    </>
  );
}
