// Blocking progress overlay for an action already in flight (e.g. batch
// work-log creation) — unlike every other modal in the app, this one has
// no close/cancel affordance and the backdrop isn't clickable, since it
// isn't asking the user to decide anything.
export default function ActionLoadingOverlay({ message }) {
  return (
    <div className="modal-overlay">
      <div className="action-loading-box">
        <div className="action-loading-spinner" aria-hidden="true" />
        <p>{message}</p>
      </div>
    </div>
  );
}
