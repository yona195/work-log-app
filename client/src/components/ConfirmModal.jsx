import ModalShell from "./ModalShell.jsx";

// Renders whatever confirmation text a caller already had (via useConfirm,
// see state/ConfirmProvider.jsx) inside the same modal chrome as the rest
// of the app, in place of the browser's native window.confirm() — same
// wording as before, just styled like everything else instead of an
// unstyled system dialog. `danger` swaps the confirm button to the same
// red delete-btn style used for destructive row actions elsewhere;
// non-destructive confirmations (archive, save, ...) keep the default
// primary-btn blue. `title` is dynamic per caller (archive/delete/save use
// their own fixed titles — see the three templates callers follow).
// `mutedText`, when given, renders as a second, de-emphasized line below
// the main message (e.g. a cascade note or "can't be undone" detail).
export default function ConfirmModal({
  title = "אישור פעולה",
  message,
  mutedText,
  confirmLabel = "אישור",
  cancelLabel = "ביטול",
  danger = false,
  onConfirm,
  onCancel,
}) {
  return (
    <ModalShell
      title={title}
      onClose={onCancel}
      actions={
        <>
          <button
            className={danger ? "delete-btn" : "primary-btn"}
            type="button"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
          <button className="secondary-btn" type="button" onClick={onCancel}>
            {cancelLabel}
          </button>
        </>
      }
    >
      <p style={{ whiteSpace: "pre-line" }}>{message}</p>
      {mutedText && <p className="modal-note">{mutedText}</p>}
    </ModalShell>
  );
}
