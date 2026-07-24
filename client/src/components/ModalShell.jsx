// Shared "titled modal with an icon + free-form body + action row" shell —
// the same modal-overlay/modal-content/h3+icon/modal-actions chrome
// already used across the app's edit modals, extracted so every message-
// style modal (an info-only acknowledgement, or a yes/no confirmation)
// shares it exactly instead of each hand-rolling the same markup.
// Clicking the backdrop behaves like every other modal in the app: it
// calls onClose, same as an explicit cancel/dismiss. `contentClassName`
// is optional, appended alongside "modal-content" — lets a caller (e.g.
// ConfirmModal) narrow its own width without affecting every other
// ModalShell-based modal's fixed width.
export default function ModalShell({
  icon = "⚠️",
  title,
  children,
  actions,
  onClose,
  contentClassName,
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal-content${contentClassName ? ` ${contentClassName}` : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
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
