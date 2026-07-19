import { useMemo, useState } from "react";

const DEFAULT_PAGE_SIZE = 20;

// Slices `items` into pages of `pageSize`, clamping automatically if the
// list shrinks (e.g. after a filter change) so a stale page index never
// shows a blank page.
export function usePagedList(items, pageSize = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const pageItems = useMemo(
    () => items.slice(startIndex, startIndex + pageSize),
    [items, startIndex, pageSize]
  );
  return { pageItems, page: currentPage, setPage, totalPages, startIndex };
}

// Compact prev/label/next control (not one button per page — that doesn't
// scale once a list runs into many pages). Renders nothing when there's
// only one page.
export default function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  return (
    <div className="pagination-compact">
      <button
        type="button"
        className="pagination-nav"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label="עמוד קודם"
      >
        ‹
      </button>
      <span className="pagination-label">
        עמוד {page} מתוך {totalPages}
      </span>
      <button
        type="button"
        className="pagination-nav"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="עמוד הבא"
      >
        ›
      </button>
    </div>
  );
}
