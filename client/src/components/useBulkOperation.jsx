import { useCallback, useState } from "react";
import BulkOperationOverlay from "./BulkOperationOverlay.jsx";

// Keeps the overlay up for at least this long, so it doesn't flash on/off
// instantly for a fast single-record operation.
const MIN_OVERLAY_MS = 450;

// Drives a blocking progress overlay for any flow that performs several
// sequential addItem/updateItem/deleteItem calls in a row — a multi-select
// bulk action, or a single action (e.g. deleting a subcontractor or a site)
// that cascades to several dependent records. Pairs with those calls'
// `{ silent: true }` option: the caller passes `silent` on every mutation
// made inside `task`, so the usual per-item toasts stay quiet and it shows
// its own single summary toast once `run` resolves.
//
// `run(title, total, task)` calls `task(setProgress)`, where `setProgress`
// updates the "X מתוך Y" counter and progress bar — call it with the
// number of items completed so far after each step.
export function useBulkOperation() {
  const [state, setState] = useState(null); // { title, current, total } | null

  const run = useCallback(async (title, total, task) => {
    const startedAt = Date.now();
    setState({ title, current: 0, total });
    const setProgress = (current) => setState((prev) => (prev ? { ...prev, current } : prev));

    // Warns on tab close/refresh while the batch is mid-flight — removed
    // in the finally block below the instant the overlay comes down.
    const warnBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);

    try {
      return await task(setProgress);
    } finally {
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_OVERLAY_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_OVERLAY_MS - elapsed));
      }
      window.removeEventListener("beforeunload", warnBeforeUnload);
      setState(null);
    }
  }, []);

  const overlay = state ? (
    <BulkOperationOverlay title={state.title} current={state.current} total={state.total} />
  ) : null;

  return { overlay, run };
}
