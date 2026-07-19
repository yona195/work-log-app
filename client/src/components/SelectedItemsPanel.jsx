// Companion to SelectionPanel: shows only the currently-selected items with
// a per-item remove action, a visible count, and a נקה הכל — used next to a
// picker panel so the user can see and adjust their selection without
// hunting for checked rows inside a long searchable list.
export default function SelectedItemsPanel({ title, items, onRemove, onClearAll, emptyMessage }) {
  return (
    <div>
      <label>
        {title} ({items.length})
      </label>
      {items.length === 0 ? (
        <div className="empty-message">{emptyMessage}</div>
      ) : (
        <>
          <div className="checkbox-list">
            {items.map((item) => (
              <div className="selected-item-row" key={item.id}>
                <span>{item.label}</span>
                <button
                  type="button"
                  className="selected-item-remove"
                  onClick={() => onRemove(item.id)}
                  aria-label={`הסר את ${item.label}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="employee-actions">
            <button type="button" className="secondary-btn" onClick={onClearAll}>
              נקה הכל
            </button>
          </div>
        </>
      )}
    </div>
  );
}
