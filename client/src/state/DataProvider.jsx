import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../api.js";

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

  // Wraps a mutation so it drives the sync indicator without touching the
  // initial-load phase (a failed save must not blank the whole app).
  const runMutation = useCallback(async (fn) => {
    setSync("saving");
    setError("");
    try {
      const result = await fn();
      setSync("idle");
      return result;
    } catch (err) {
      console.error("Mutation failed:", err);
      setSync("error");
      setError(err.message);
      throw err;
    }
  }, []);

  const addItem = useCallback(
    (collection, item) =>
      runMutation(async () => {
        const created = await api.create(collection, item);
        setData((prev) => ({
          ...prev,
          [collection]: [...prev[collection], created],
        }));
        return created;
      }),
    [runMutation]
  );

  const updateItem = useCallback(
    (collection, id, patch) =>
      runMutation(async () => {
        const updated = await api.update(collection, id, patch);
        setData((prev) => ({
          ...prev,
          [collection]: prev[collection].map((item) =>
            String(item.id) === String(id) ? updated : item
          ),
        }));
        return updated;
      }),
    [runMutation]
  );

  const deleteItem = useCallback(
    (collection, id) =>
      runMutation(async () => {
        await api.remove(collection, id);
        setData((prev) => ({
          ...prev,
          [collection]: prev[collection].filter(
            (item) => String(item.id) !== String(id)
          ),
        }));
      }),
    [runMutation]
  );

  const value = {
    data,
    phase,
    sync,
    error,
    reload: load,
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
