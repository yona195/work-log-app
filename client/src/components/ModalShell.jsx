// Shared "titled modal with an icon + free-form body + action row" shell —
// the same modal-overlay/modal-content/h3+icon/modal-actions chrome
// already used across the app's edit modals, extracted so every message-
// style modal (an info-only acknowledgement, or a yes/no confirmation)
// shares it exactly instead of each hand-rolling the same markup.
// Clicking the backdrop behaves like every other modal in the app: it
// calls onClose, same as an explicit cancel/dismiss.
export default function ModalShell({ icon = "⚠️", title, children, actions, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>
          {icon ? `${icon} ` : ""}
          {title}
        </h3>
        {children}
        <div className="modal-actions">{actions}</div>
      </div>
    </div>
  );
}
