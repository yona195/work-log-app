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

// Richer footer (page-size selector + "מציג X–Y מתוך Z רשומות" + prev/
// next) — originally built inline for Work History, extracted here for
// reuse. Unlike the compact Pagination above, this never hides itself at a
// single page (the page-size selector stays useful even with few items),
// so the caller is responsible for only rendering it when the underlying
// list is non-empty (mirroring whatever empty-state branch it already has).
export function ListPagination({
  page,
  totalPages,
  onPageChange,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 20, 50],
  startIndex,
  totalItems,
}) {
  const rangeStart = totalItems === 0 ? 0 : startIndex + 1;
  const rangeEnd = Math.min(startIndex + pageSize, totalItems);
  return (
    <div className="workhistory-pagination">
      <div className="workhistory-page-size">
        <span>רשומות בעמוד:</span>
        {pageSizeOptions.map((size) => (
          <button
            key={size}
            type="button"
            className={pageSize === size ? "primary-btn" : "secondary-btn"}
            onClick={() => onPageSizeChange(size)}
          >
            {size}
          </button>
        ))}
      </div>

      <div className="workhistory-page-nav">
        <span className="workhistory-page-info">
          מציג {rangeStart}–{rangeEnd} מתוך {totalItems} רשומות
        </span>
        <div className="pagination-nav-group">
          <button
            type="button"
            className="pagination-nav"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="עמוד קודם"
          >
            ‹
          </button>
          <button
            type="button"
            className="pagination-nav"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            aria-label="עמוד הבא"
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
}
