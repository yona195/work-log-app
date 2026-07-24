import { createContext, useCallback, useContext, useState } from "react";
import ConfirmModal from "../components/ConfirmModal.jsx";

const ConfirmContext = createContext(null);

// App-wide replacement for window.confirm(): one modal instance rendered
// here, driven by whichever call is currently pending. `confirmDialog(...)`
// returns a Promise<boolean> exactly like the synchronous confirm() it
// replaces did (true = confirmed, false = cancelled/dismissed), so callers
// only need to add `await` — `if (!(await confirmDialog(message))) return;`
// is a drop-in replacement for `if (!confirm(message)) return;`.
export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null);

  const confirmDialog = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      setRequest({ message, resolve, ...options });
    });
  }, []);

  const respond = (value) => {
    request.resolve(value);
    setRequest(null);
  };

  return (
    <ConfirmContext.Provider value={confirmDialog}>
      {children}
      {request && (
        <ConfirmModal
          title={request.title}
          message={request.message}
          mutedText={request.mutedText}
          danger={request.danger}
          confirmLabel={request.confirmLabel}
          cancelLabel={request.cancelLabel}
          onConfirm={() => respond(true)}
          onCancel={() => respond(false)}
        />
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm must be used within a ConfirmProvider");
  }
  return context;
}
