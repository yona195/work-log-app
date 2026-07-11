import { useState } from "react";
import { useData } from "../state/DataProvider.jsx";

export default function SimpleManager({ collection, placeholder }) {
  const { data, addItem, deleteItem } = useData();
  const [name, setName] = useState("");
  const items = data[collection] || [];

  const add = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      alert("נא להזין שם");
      return;
    }
    await addItem(collection, { name: trimmed });
    setName("");
  };

  return (
    <>
      <div className="card">
        <h3>הוספה</h3>
        <input
          placeholder={placeholder}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button className="primary-btn" type="button" onClick={add}>
          הוסף
        </button>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h3>רשימה קיימת</h3>
        {items.length === 0 ? (
          <p>אין עדיין נתונים</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>שם</th>
                <th>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.id}>
                  <td>{index + 1}</td>
                  <td>{item.name}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => deleteItem(collection, item.id)}
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
