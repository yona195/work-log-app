import { useMemo, useState } from "react";
import { useData } from "../state/DataProvider.jsx";
import { activeOnly } from "../lib/entities.js";

export default function EditEmployeeModal({ employee, onClose }) {
  const { data, updateItem } = useData();
  const subcontractors = activeOnly(data.subcontractors);

  const [name, setName] = useState(employee.name);
  const [type, setType] = useState(employee.type);
  const [subcontractorId, setSubcontractorId] = useState(
    employee.subcontractorId || ""
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Keep the employee's current subcontractor selectable even if it was
  // archived since this employee was assigned to it.
  const subcontractorOptions = useMemo(() => {
    if (subcontractors.some((s) => String(s.id) === String(employee.subcontractorId))) {
      return subcontractors;
    }
    const archived = (data.subcontractors || []).find(
      (s) => String(s.id) === String(employee.subcontractorId)
    );
    return archived ? [...subcontractors, archived] : subcontractors;
  }, [subcontractors, data.subcontractors, employee.subcontractorId]);

  const save = async () => {
    if (isSubmitting) return;
    const trimmed = name.trim();
    if (!trimmed) {
      alert("נא להזין שם עובד");
      return;
    }
    if (type === "subcontractor" && !subcontractorId) {
      alert("נא לבחור קבלן משנה");
      return;
    }
    if (!confirm("לשמור את השינויים?")) return;

    setIsSubmitting(true);
    try {
      await updateItem("employees", employee.id, {
        name: trimmed,
        type,
        subcontractorId: type === "subcontractor" ? subcontractorId : "",
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>עריכת עובד</h3>

        <label>שם עובד</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />

        <label>שיוך עובד</label>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="internal">עובד שלי</option>
          <option value="subcontractor">עובד קבלן משנה</option>
        </select>

        {type === "subcontractor" && (
          <>
            <label>קבלן משנה</label>
            <select
              value={subcontractorId}
              onChange={(e) => setSubcontractorId(e.target.value)}
            >
              <option value="">בחר קבלן משנה</option>
              {subcontractorOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.archived ? " (בארכיון)" : ""}
                </option>
              ))}
            </select>
          </>
        )}

        <div className="modal-actions">
          <button
            className="primary-btn"
            type="button"
            onClick={save}
            disabled={isSubmitting}
          >
            {isSubmitting ? "שומר..." : "שמור"}
          </button>
          <button className="secondary-btn" type="button" onClick={onClose}>
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
