// Blocking progress overlay for a flow that performs several sequential
// mutations in a row (see components/useBulkOperation.jsx) — no close/
// cancel affordance and the backdrop isn't clickable, since it isn't
// asking the user to decide anything.
export default function BulkOperationOverlay({ title, current, total }) {
  const percent = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;

  return (
    <div className="modal-overlay">
      <div className="bulk-operation-box">
        <div className="action-loading-spinner" aria-hidden="true" />
        <h3>{title}</h3>
        <p className="bulk-operation-subtitle">נא לא לסגור את הדף עד לסיום</p>
        <div className="bulk-operation-progress-track">
          <div className="bulk-operation-progress-fill" style={{ width: `${percent}%` }} />
        </div>
        <p className="bulk-operation-count">
          {current} מתוך {total}
        </p>
      </div>
    </div>
  );
}
