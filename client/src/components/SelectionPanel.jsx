// Shared shell for an always-visible, searchable multi-select list: a
// labeled search box, a scrollable checkbox list, and select-all/clear-all
// directly below it. Used wherever a picker needs to stay open (never
// requiring an extra click) — e.g. contractor/employee panels on the
// Workforce Reports and Work Registration pages.
export default function SelectionPanel({
  title,
  required = false,
  search,
  onSearchChange,
  searchPlaceholder,
  items,
  selectedIds,
  onToggle,
  onSelectAll,
  onClearAll,
  emptyMessage,
}) {
  return (
    <div>
      <label>
        {title}
        {required && <span className="required-mark"> *</span>}
      </label>
      <input
        type="text"
        placeholder={searchPlaceholder}
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      <div className="checkbox-list">
        {items.length === 0 ? (
          <div className="empty-message">{emptyMessage}</div>
        ) : (
          items.map((item) => (
            <label className="checkbox-item" key={item.id}>
              <input
                type="checkbox"
                checked={selectedIds.includes(item.id)}
                onChange={() => onToggle(item.id)}
              />
              <span>{item.label}</span>
            </label>
          ))
        )}
      </div>
      <div className="employee-actions">
        <button type="button" className="secondary-btn" onClick={onSelectAll}>
          בחר הכל
        </button>
        <button type="button" className="secondary-btn" onClick={onClearAll}>
          נקה הכל
        </button>
      </div>
    </div>
  );
}
