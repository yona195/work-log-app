import { useEffect, useState } from "react";

// Shared "checkbox per row + select-all" selection state, used by every
// management page (Rates, Employees, Sites, Customers) that offers bulk
// archive/delete. `pruneScope` is whatever the page currently considers
// "still on screen" (e.g. the filtered/sorted list before pagination) — an
// id gets dropped from the selection the moment it's no longer in that
// list (deleted, archived-and-hidden, filtered out, ...), so "X selected"
// never counts something no longer visible.
//
// `isFullySelected`/`toggleAll` take an explicit `items` array rather than
// reading some fixed list, so the SAME function serves both the page-level
// "select all" (pass the current page's full item list) and a single
// card's "select all in this group" (pass just that group's items) with
// no extra code per page.
export function useBulkSelection(pruneScope) {
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    const validIds = new Set(pruneScope.map((item) => item.id));
    setSelectedIds((prev) => prev.filter((id) => validIds.has(id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pruneScope]);

  const toggle = (id) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const isFullySelected = (items) =>
    items.length > 0 && items.every((item) => selectedIds.includes(item.id));

  const toggleAll = (items) =>
    setSelectedIds((prev) =>
      isFullySelected(items)
        ? prev.filter((id) => !items.some((item) => item.id === id))
        : [...new Set([...prev, ...items.map((item) => item.id)])]
    );

  const clear = () => setSelectedIds([]);

  return { selectedIds, toggle, isFullySelected, toggleAll, clear };
}
