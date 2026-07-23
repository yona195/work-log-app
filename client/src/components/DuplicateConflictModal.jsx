import ModalShell from "./ModalShell.jsx";

export default function DuplicateConflictModal({ conflicts, onClose }) {
  return (
    <ModalShell
      title="לא ניתן להוסיף"
      onClose={onClose}
      actions={
        <button className="primary-btn" type="button" onClick={onClose}>
          סגור
        </button>
      }
    >
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
    </ModalShell>
  );
}
