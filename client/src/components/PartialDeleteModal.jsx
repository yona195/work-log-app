export default function PartialDeleteModal({ employeeNames, onRemoveFiltered, onDeleteAll, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>מחיקת רשומה מסוננת</h3>
        <p>הרשומה הזו כוללת גם עובדים נוספים מעבר לסינון הנוכחי. מה לעשות?</p>
        <div className="modal-actions" style={{ flexDirection: "column", alignItems: "stretch" }}>
          <button className="secondary-btn" type="button" onClick={onRemoveFiltered}>
            הסר את {employeeNames} מהרשומה
          </button>
          <button className="delete-btn" type="button" onClick={onDeleteAll}>
            מחק את כל הרשומה
          </button>
          <button className="secondary-btn" type="button" onClick={onClose}>
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
