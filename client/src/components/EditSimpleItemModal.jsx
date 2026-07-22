import { useState } from "react";

// Generic single-name-field edit modal, reused for subcontractors, sites,
// customers, employees, and buildings — collections whose only editable
// attribute (through this modal) is their name. `validate` is optional —
// omitted everywhere except buildings, which reject renaming into the
// reserved default-building name.
export default function EditSimpleItemModal({ title, initialName, onSave, onClose, validate }) {
  const [name, setName] = useState(initialName);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const save = async () => {
    if (isSubmitting) return;
    const trimmed = name.trim();
    if (!trimmed) {
      alert("נא להזין שם");
      return;
    }
    if (validate) {
      const error = validate(trimmed);
      if (error) {
        alert(error);
        return;
      }
    }
    if (!confirm("לשמור את השינויים?")) return;

    setIsSubmitting(true);
    try {
      await onSave(trimmed);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>

        <label>שם</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
        />

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
