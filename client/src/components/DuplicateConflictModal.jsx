export default function DuplicateConflictModal({ siteName, groups, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>⚠️ לא ניתן להוסיף</h3>
        <p>
          העובדים הבאים כבר רשומים באתר <strong>{siteName}</strong> בתאריכים
          המצוינים - הוספה בוטלה כדי למנוע כפילות:
        </p>

        <table>
          <thead>
            <tr>
              <th>עובד</th>
              <th>תאריכים</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <tr key={group.employeeName}>
                <td>{group.employeeName}</td>
                <td dir="ltr">{group.dates.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="modal-actions">
          <button className="primary-btn" type="button" onClick={onClose}>
            סגור
          </button>
        </div>
      </div>
    </div>
  );
}
