import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../api.js";
import { useToast } from "./ToastProvider.jsx";
import { getSuccessMessage, getErrorMessage } from "../lib/actionMessages.js";

const EMPTY_DATA = {
  employees: [],
  subcontractors: [],
  sites: [],
  buildings: [],
  customers: [],
  rates: [],
  workLogs: [],
  previousLogin: null,
};

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const { showToast } = useToast();
  const [data, setData] = useState(EMPTY_DATA);
  const [phase, setPhase] = useState("loading"); // loading | ready | error (initial load)
  const [sync, setSync] = useState("idle"); // idle | saving | error (mutations)
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setPhase("loading");
    setError("");
    try {
      const result = await api.getData();
      setData({ ...EMPTY_DATA, ...result });
      setPhase("ready");
      setSync("idle");
    } catch (err) {
      console.error("Failed to load data:", err);
      setError(err.message);
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Quietly re-pulls the full dataset without flipping `phase` back to
  // "loading" (which would replace the whole app with the full-screen
  // loading state) — for callers whose own mutation had a server-side side
  // effect not reflected in the item it got back (e.g. creating a site also
  // creates its "כללי" building, which addItem's local-state patch never
  // sees since the API only returns the site).
  const refresh = useCallback(async () => {
    try {
      const result = await api.getData();
      setData({ ...EMPTY_DATA, ...result });
    } catch (err) {
      console.error("Failed to refresh data:", err);
    }
  }, []);

  // Wraps a mutation so it drives the sync indicator without touching the
  // initial-load phase (a failed save must not blank the whole app). `meta`
  // (collection + what kind of change) drives the toast copy — every
  // add/update/delete across the app funnels through here, so this is the
  // one place that needs to know how to word the notification.
  const runMutation = useCallback(
    async (fn, meta, options = {}) => {
      setSync("saving");
      setError("");
      try {
        const result = await fn();
        setSync("idle");
        if (meta && !options.silent) showToast("success", getSuccessMessage(meta.collection, meta.kind));
        return result;
      } catch (err) {
        console.error("Mutation failed:", err);
        setSync("error");
        setError(err.message);
        if (meta && !options.silent) showToast("error", getErrorMessage(meta.collection, meta.kind, err));
        throw err;
      }
    },
    [showToast]
  );

  // `options.silent` skips the automatic added/error toast for this one
  // call — for callers (e.g. a batch-create flow with its own loading
  // overlay and single summary toast at the end) that need to fully own
  // notifying the user instead of getting one toast per item.
  const addItem = useCallback(
    (collection, item, options = {}) =>
      runMutation(
        async () => {
          const created = await api.create(collection, item);
          setData((prev) => ({
            ...prev,
            [collection]: [...prev[collection], created],
          }));
          return created;
        },
        { collection, kind: "added" },
        options
      ),
    [runMutation]
  );

  const updateItem = useCallback(
    (collection, id, patch, options = {}) =>
      runMutation(
        async () => {
          const updated = await api.update(collection, id, patch);
          setData((prev) => ({
            ...prev,
            [collection]: prev[collection].map((item) =>
              String(item.id) === String(id) ? updated : item
            ),
          }));
          return updated;
        },
        {
          collection,
          kind:
            patch && "archived" in patch
              ? patch.archived
                ? "archived"
                : "restored"
              : "updated",
        },
        options
      ),
    [runMutation]
  );

  const deleteItem = useCallback(
    (collection, id, options = {}) =>
      runMutation(
        async () => {
          await api.remove(collection, id);
          setData((prev) => ({
            ...prev,
            [collection]: prev[collection].filter(
              (item) => String(item.id) !== String(id)
            ),
          }));
        },
        { collection, kind: "deleted" },
        options
      ),
    [runMutation]
  );

  const value = {
    data,
    phase,
    sync,
    error,
    reload: load,
    refresh,
    addItem,
    updateItem,
    deleteItem,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
}
