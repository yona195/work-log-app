export default function DuplicateConflictModal({ conflicts, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>⚠️ לא ניתן להוסיף</h3>
        <p>
          העובדים הבאים כבר רשומים לעבודה באותם תאריכים - הוספה בוטלה כדי
          למנוע כפילות (עובד לא יכול להיות רשום פעמיים באותו יום, גם אם
          באתר אחר):
        </p>

        <table>
          <thead>
            <tr>
              <th>עובד</th>
              <th>תאריך</th>
              <th>רשום כבר באתר</th>
            </tr>
          </thead>
          <tbody>
            {conflicts.map((row, index) => (
              <tr key={`${row.employeeName}-${row.date}-${index}`}>
                <td>{row.employeeName}</td>
                <td dir="ltr">{row.date}</td>
                <td>{row.siteName}</td>
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
