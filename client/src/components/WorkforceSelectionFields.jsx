import SelectionPanel from "./SelectionPanel.jsx";
import SelectedItemsPanel from "./SelectedItemsPanel.jsx";

// Shared "who is this for" picker — the workforce-type toggle (כל העובדים /
// העובדים שלי / עובדי קבלן) plus the panel(s) next to it, used identically
// on Work Registration, Employee Reports and Customer Reports:
//   - "כל העובדים"/"העובדים שלי": 2 panels — employee picker, then a
//     read-only "עובדים שנבחרו" summary of the actual selection.
//   - "עובדי קבלן": 3 panels — contractor picker (multi-select), then an
//     employee picker scoped to the selected contractors (accumulated
//     across all of them), then the same "עובדים שנבחרו" summary.
// Purely structural — search text and the eligible item pools (already
// narrowed by group/contractor/archived, and already text-filtered) stay
// owned by the caller, exactly as each page already did before this was
// extracted, so no filtering behavior moves or duplicates here.
export default function WorkforceSelectionFields({
  group,
  onGroupChange,
  contractorSearch,
  onContractorSearchChange,
  contractorItems,
  selectedContractorIds,
  onToggleContractor,
  onSelectAllContractors,
  onClearAllContractors,
  employeeSearch,
  onEmployeeSearchChange,
  employeeItems,
  selectedEmployeeIds,
  onToggleEmployee,
  onSelectAllEmployees,
  onClearAllEmployees,
  selectedEmployeeItems,
  required = false,
}) {
  const showContractorField = group === "all-subcontractors";

  return (
    <>
      <div className="employee-actions">
        <button
          type="button"
          className={group === "" ? "primary-btn" : "secondary-btn"}
          onClick={() => onGroupChange("")}
        >
          כל העובדים
        </button>
        <button
          type="button"
          className={group === "internal" ? "primary-btn" : "secondary-btn"}
          onClick={() => onGroupChange("internal")}
        >
          העובדים שלי
        </button>
        <button
          type="button"
          className={group === "all-subcontractors" ? "primary-btn" : "secondary-btn"}
          onClick={() => onGroupChange("all-subcontractors")}
        >
          עובדי קבלן
        </button>
      </div>

      {showContractorField ? (
        <div className="filter-grid filter-grid-3 workforce-selection-grid" style={{ marginTop: 14 }}>
          <div className="filter-grid-item">
            <SelectionPanel
              title="בחירת קבלן"
              search={contractorSearch}
              onSearchChange={onContractorSearchChange}
              searchPlaceholder="🔍 חפש קבלן..."
              items={contractorItems}
              selectedIds={selectedContractorIds}
              onToggle={onToggleContractor}
              onSelectAll={onSelectAllContractors}
              onClearAll={onClearAllContractors}
              emptyMessage="אין קבלני משנה עם עובדים"
            />
          </div>

          <div className="filter-grid-item">
            {selectedContractorIds.length === 0 ? (
              <div>
                <label>
                  בחירת עובדי הקבלן
                  {required && <span className="required-mark"> *</span>}
                </label>
                <div className="checkbox-list">
                  <div className="empty-message">יש לבחור קבלן תחילה</div>
                </div>
              </div>
            ) : (
              <SelectionPanel
                title="בחירת עובדי הקבלן"
                required={required}
                search={employeeSearch}
                onSearchChange={onEmployeeSearchChange}
                searchPlaceholder="🔍 חפש עובד..."
                items={employeeItems}
                selectedIds={selectedEmployeeIds}
                onToggle={onToggleEmployee}
                onSelectAll={onSelectAllEmployees}
                onClearAll={onClearAllEmployees}
                emptyMessage="אין עובדים תואמים"
              />
            )}
          </div>

          <div className="filter-grid-item">
            <SelectedItemsPanel
              title="עובדים שנבחרו"
              items={selectedEmployeeItems}
              onRemove={onToggleEmployee}
              onClearAll={onClearAllEmployees}
              emptyMessage="טרם נבחרו עובדים"
            />
          </div>
        </div>
      ) : (
        <div className="filter-grid filter-grid-2 workforce-selection-grid" style={{ marginTop: 14 }}>
          <div className="filter-grid-item">
            <SelectionPanel
              title="בחירת עובדים"
              required={required}
              search={employeeSearch}
              onSearchChange={onEmployeeSearchChange}
              searchPlaceholder="🔍 חפש עובד..."
              items={employeeItems}
              selectedIds={selectedEmployeeIds}
              onToggle={onToggleEmployee}
              onSelectAll={onSelectAllEmployees}
              onClearAll={onClearAllEmployees}
              emptyMessage="אין עובדים תואמים"
            />
          </div>

          <div className="filter-grid-item">
            <SelectedItemsPanel
              title="עובדים שנבחרו"
              items={selectedEmployeeItems}
              onRemove={onToggleEmployee}
              onClearAll={onClearAllEmployees}
              emptyMessage="טרם נבחרו עובדים"
            />
          </div>
        </div>
      )}
    </>
  );
}
