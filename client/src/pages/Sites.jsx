import { useMemo, useState } from "react";
import { useData } from "../state/DataProvider.jsx";
import { useConfirm } from "../state/ConfirmProvider.jsx";
import {
  activeOnly,
  getBuildingIds,
  GENERAL_BUILDING_NAME,
  isGeneralBuilding,
} from "../lib/entities.js";
import EditSimpleItemModal from "../components/EditSimpleItemModal.jsx";
import GroupCard from "../components/GroupCard.jsx";
import CompactRow from "../components/CompactRow.jsx";
import { useBulkSelection } from "../components/useBulkSelection.js";

export default function Sites() {
  const { data, addItem, updateItem, deleteItem, refresh } = useData();
  const confirmDialog = useConfirm();
  const { sites, buildings, workLogs, rates } = data;

  const [siteName, setSiteName] = useState("");
  const [isAddingSite, setIsAddingSite] = useState(false);
  const [editingSite, setEditingSite] = useState(null);

  const [buildingSiteId, setBuildingSiteId] = useState("");
  const [buildingName, setBuildingName] = useState("");
  const [isAddingBuilding, setIsAddingBuilding] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState(null);

  const [showArchived, setShowArchived] = useState(false);

  const visibleSites = showArchived ? sites : activeOnly(sites);
  const visibleBuildings = showArchived ? buildings : activeOnly(buildings);

  // The auto-created default building is never individually selectable
  // (it has no edit/delete/archive of its own either) — excluded up front
  // so it can never end up in the selection or be swept up by a group's
  // "select all".
  const selectableBuildings = useMemo(
    () => visibleBuildings.filter((b) => !isGeneralBuilding(b)),
    [visibleBuildings]
  );

  const {
    selectedIds: selectedBuildingIds,
    toggle: toggleBuildingSelection,
    isFullySelected: isBuildingGroupFullySelected,
    toggleAll: toggleAllBuildings,
    clear: clearBuildingSelection,
  } = useBulkSelection(selectableBuildings);

  const isAllVisibleBuildingsSelected = isBuildingGroupFullySelected(selectableBuildings);
  const toggleSelectAllVisibleBuildings = () => toggleAllBuildings(selectableBuildings);

  // Every delete button on this page (row/group/bulk) is hidden until this
  // is checked — "ארכיון"/"ערוך" stay visible either way, since only delete
  // is dangerous enough to need a second, explicit door.
  const [advancedModeEnabled, setAdvancedModeEnabled] = useState(false);

  const canAddSite = siteName.trim().length > 0 && !isAddingSite;
  const canAddBuilding = Boolean(buildingSiteId) && buildingName.trim().length > 0 && !isAddingBuilding;

  const addSite = async () => {
    if (isAddingSite) return;
    const trimmed = siteName.trim();
    if (!trimmed) {
      alert("נא להזין שם אתר");
      return;
    }
    setIsAddingSite(true);
    try {
      await addItem("sites", { name: trimmed });
      setSiteName("");
      // The server also creates a "כללי" building for the new site as a
      // side effect, but the response to this call only carries the site
      // itself — refresh so that building shows up immediately instead of
      // only after a manual reload.
      await refresh();
    } finally {
      setIsAddingSite(false);
    }
  };

  const addBuilding = async () => {
    if (isAddingBuilding) return;
    if (!buildingSiteId) {
      alert("נא לבחור אתר עבודה");
      return;
    }
    const trimmed = buildingName.trim();
    if (!trimmed) {
      alert("נא להזין שם מבנה");
      return;
    }
    if (trimmed === GENERAL_BUILDING_NAME) {
      alert(`השם "${GENERAL_BUILDING_NAME}" שמור למבנה ברירת המחדל של האתר, שכבר קיים אוטומטית.`);
      return;
    }
    setIsAddingBuilding(true);
    try {
      await addItem("buildings", { siteId: buildingSiteId, name: trimmed });
      setBuildingName("");
    } finally {
      setIsAddingBuilding(false);
    }
  };

  const toggleBuildingArchive = async (building) => {
    if (building.archived) {
      await updateItem("buildings", building.id, { archived: false });
      return;
    }
    if (
      !(await confirmDialog(
        `להעביר את ${building.name} לארכיון? המבנה לא יופיע יותר לבחירה ברשומות חדשות, אבל הדוחות הקיימים לא ישתנו.`
      ))
    ) {
      return;
    }
    await updateItem("buildings", building.id, { archived: true });
  };

  // Deliberately the opposite of the site/customer/subcontractor → rates
  // policy (cascade-delete there): a building is just an internal location
  // tag, not a billing unit, so deleting one must never break or wipe out
  // work-log records that already reference it. Every affected record gets
  // repointed to the site's own "כללי" building instead — every other field
  // (date, employees, site, customer) stays exactly as it was. `logState`
  // is a shared, mutable {logId -> current buildingIds} map so that when
  // several buildings are deleted together in one bulk pass, each one sees
  // the previous ones' already-applied repoints instead of a stale snapshot.
  const deleteBuildingsCascade = async (buildingsToDelete, logState) => {
    for (const building of buildingsToDelete) {
      if (isGeneralBuilding(building)) continue; // never reaches here anyway
      const generalBuilding = buildings.find(
        (b) => String(b.siteId) === String(building.siteId) && isGeneralBuilding(b)
      );
      for (const [logId, currentIds] of logState.entries()) {
        if (!currentIds.includes(String(building.id))) continue;
        const remainingIds = currentIds.filter((id) => id !== String(building.id));
        const nextIds =
          generalBuilding && !remainingIds.includes(String(generalBuilding.id))
            ? [...remainingIds, generalBuilding.id]
            : remainingIds;
        // eslint-disable-next-line no-await-in-loop
        await updateItem("workLogs", logId, { buildingIds: nextIds });
        logState.set(logId, nextIds);
      }
      // eslint-disable-next-line no-await-in-loop
      await deleteItem("buildings", building.id);
    }
  };

  const deleteBuilding = async (building) => {
    if (isGeneralBuilding(building)) return; // no delete button reaches here anyway
    const affectedLogs = workLogs.filter((log) =>
      getBuildingIds(log).map(String).includes(String(building.id))
    );

    const confirmMessage =
      affectedLogs.length > 0
        ? `למחוק את ${building.name} לצמיתות? ${affectedLogs.length} רשומות עבודה שמצביעות על המבנה הזה יעברו אוטומטית למבנה "${GENERAL_BUILDING_NAME}" של האתר - שאר נתוני הרשומות (תאריך, עובדים, אתר, מזמין) יישארו ללא שינוי.`
        : `למחוק את ${building.name} לצמיתות?`;
    if (!(await confirmDialog(confirmMessage, { danger: true }))) return;

    const logState = new Map(workLogs.map((log) => [log.id, getBuildingIds(log).map(String)]));
    await deleteBuildingsCascade([building], logState);
  };

  const bulkArchiveSelectedBuildings = async () => {
    if (
      !(await confirmDialog(
        `להעביר את ${selectedBuildingIds.length} המבנים שנבחרו לארכיון? המבנים לא יופיעו יותר לבחירה ברשומות חדשות, אבל הדוחות הקיימים לא ישתנו.`
      ))
    ) {
      return;
    }
    for (const id of selectedBuildingIds) {
      // eslint-disable-next-line no-await-in-loop
      await updateItem("buildings", id, { archived: true });
    }
    clearBuildingSelection();
  };

  const bulkDeleteSelectedBuildings = async () => {
    const selected = buildings.filter((b) => selectedBuildingIds.includes(b.id));
    if (
      !(await confirmDialog(
        `למחוק ${selected.length} מבנים שנבחרו לצמיתות? רשומות עבודה שמצביעות עליהם יעברו אוטומטית למבנה "${GENERAL_BUILDING_NAME}" של האתר המתאים - שאר נתוני הרשומות יישארו ללא שינוי.`,
        { danger: true }
      ))
    ) {
      return;
    }
    const logState = new Map(workLogs.map((log) => [log.id, getBuildingIds(log).map(String)]));
    await deleteBuildingsCascade(selected, logState);
    clearBuildingSelection();
  };

  // Actions on a site cascade to its own buildings (archive/restore/
  // delete all move together), matching the contractor -> employee
  // cascade in Employees.jsx — but the reverse never happens; touching
  // one building must never affect its site or siblings.
  const buildingsOfSite = (site) =>
    buildings.filter((b) => String(b.siteId || "") === String(site.id));

  const toggleSiteArchive = async (site) => {
    const siteBuildings = buildingsOfSite(site);
    if (site.archived) {
      await updateItem("sites", site.id, { archived: false });
      for (const building of siteBuildings) {
        // eslint-disable-next-line no-await-in-loop
        await updateItem("buildings", building.id, { archived: false });
      }
      return;
    }
    const buildingNote =
      siteBuildings.length > 0 ? ` וכל ${siteBuildings.length} המבנים שלו` : "";
    if (
      !(await confirmDialog(
        `להעביר את ${site.name}${buildingNote} לארכיון? לא יופיעו יותר לבחירה ברשומות חדשות, אבל הדוחות הקיימים לא ישתנו.`
      ))
    ) {
      return;
    }
    await updateItem("sites", site.id, { archived: true });
    for (const building of siteBuildings) {
      // eslint-disable-next-line no-await-in-loop
      await updateItem("buildings", building.id, { archived: true });
    }
  };

  // Unlike deleteBuilding above, a site IS the billing unit — deleting one
  // deletes everything that depends on it (rates and work-log/history
  // records), it never falls back to something else. This only fires from
  // the explicit delete action below; archiving a site (toggleSiteArchive)
  // never touches rates or work logs, same as archiving anywhere else in
  // the app.
  const deleteSite = async (site) => {
    const siteBuildings = buildingsOfSite(site);
    const siteRates = rates.filter((r) => String(r.siteId) === String(site.id));
    const siteWorkLogs = workLogs.filter((log) => String(log.siteId) === String(site.id));

    const cascadeParts = [];
    if (siteBuildings.length > 0) cascadeParts.push(`${siteBuildings.length} המבנים שלו`);
    if (siteRates.length > 0) cascadeParts.push(`${siteRates.length} תעריפים`);
    if (siteWorkLogs.length > 0) cascadeParts.push(`${siteWorkLogs.length} רשומות עבודה`);
    const cascadeNote = cascadeParts.length > 0 ? ` וכל ${cascadeParts.join(", ")}` : "";

    if (
      !(await confirmDialog(
        `למחוק את ${site.name}${cascadeNote} לצמיתות? בשונה מהעברה לארכיון, מחיקה תשפיע גם על דוחות והיסטוריה שכבר נרשמו.`,
        { danger: true }
      ))
    ) {
      return;
    }
    for (const log of siteWorkLogs) {
      // eslint-disable-next-line no-await-in-loop
      await deleteItem("workLogs", log.id);
    }
    for (const rate of siteRates) {
      // eslint-disable-next-line no-await-in-loop
      await deleteItem("rates", rate.id);
    }
    for (const building of siteBuildings) {
      // eslint-disable-next-line no-await-in-loop
      await deleteItem("buildings", building.id);
    }
    await deleteItem("sites", site.id);
  };

  // Every building requires a site, so unlike "העובדים שלי" there's no
  // built-in default group — but a building can still end up without a
  // live site card to render under if its site was deleted before the
  // cascade above existed (legacy data). Surfaced separately so it's
  // never silently hidden.
  const existingSiteIds = new Set(sites.map((s) => String(s.id)));
  const orphanedBuildings = visibleBuildings.filter(
    (b) => !b.siteId || !existingSiteIds.has(String(b.siteId))
  );

  return (
    <>
      <div className="filter-grid filter-grid-2">
        <div className="filter-grid-item">
          <div className="card" style={{ height: "100%" }}>
            <h3>הוספת אתר עבודה</h3>

            <label>שם אתר</label>
            <input
              placeholder="שם אתר"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addSite()}
            />

            <button
              className="primary-btn"
              type="button"
              onClick={addSite}
              disabled={!canAddSite}
            >
              {isAddingSite ? "מוסיף..." : "הוסף אתר עבודה"}
            </button>
          </div>
        </div>

        <div className="filter-grid-item">
          <div className="card" style={{ height: "100%" }}>
            <h3>הוספת מבנה</h3>

            <label>
              אתר עבודה
              <span className="required-mark"> *</span>
            </label>
            <select value={buildingSiteId} onChange={(e) => setBuildingSiteId(e.target.value)}>
              <option value="">בחר אתר</option>
              {activeOnly(sites).map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>

            <label>שם מבנה</label>
            <input
              placeholder="שם מבנה"
              value={buildingName}
              onChange={(e) => setBuildingName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addBuilding()}
            />

            <button
              className="primary-btn"
              type="button"
              onClick={addBuilding}
              disabled={!canAddBuilding}
            >
              {isAddingBuilding ? "מוסיף..." : "הוסף מבנה"}
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="section-title-row">
          <h3>אתרי עבודה</h3>
          <label className="checkbox-item" style={{ display: "inline-flex" }}>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            <span>הצג פריטים בארכיון</span>
          </label>
        </div>

        {selectableBuildings.length > 0 && (
          <div className="bulk-select-row">
            <label className="checkbox-item">
              <input
                type="checkbox"
                checked={isAllVisibleBuildingsSelected}
                onChange={toggleSelectAllVisibleBuildings}
              />
              <span>בחר הכל</span>
            </label>
            <label className="checkbox-item">
              <input
                type="checkbox"
                checked={advancedModeEnabled}
                onChange={(e) => setAdvancedModeEnabled(e.target.checked)}
              />
              <span>מצב מתקדם</span>
            </label>
            {selectedBuildingIds.length > 0 && (
              <div className="report-row-actions bulk-actions-inline">
                <button className="archive-btn" type="button" onClick={bulkArchiveSelectedBuildings}>
                  ארכיון ({selectedBuildingIds.length})
                </button>
                {advancedModeEnabled && (
                  <button className="delete-btn" type="button" onClick={bulkDeleteSelectedBuildings}>
                    מחק ({selectedBuildingIds.length})
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {visibleSites.length === 0 ? (
          <p className="empty-message">אין עדיין אתרי עבודה.</p>
        ) : (
          <div className="employees-contractor-list">
            {visibleSites.map((site) => {
              const siteBuildings = visibleBuildings.filter(
                (b) => String(b.siteId || "") === String(site.id)
              );
              const selectableSiteBuildings = siteBuildings.filter((b) => !isGeneralBuilding(b));
              return (
                <GroupCard
                  key={site.id}
                  icon="location_city"
                  title={site.name}
                  count={siteBuildings.length}
                  countLabel="מבנים"
                  isArchived={site.archived}
                  selectionControl={
                    selectableSiteBuildings.length > 0 && (
                      <input
                        type="checkbox"
                        checked={isBuildingGroupFullySelected(selectableSiteBuildings)}
                        onChange={() => toggleAllBuildings(selectableSiteBuildings)}
                        aria-label={`בחר הכל - ${site.name}`}
                      />
                    )
                  }
                  groupActions={
                    <div className="report-row-actions">
                      <button
                        className="edit-btn"
                        type="button"
                        onClick={() => setEditingSite(site)}
                      >
                        ערוך אתר
                      </button>
                      {advancedModeEnabled && (
                        <button
                          className="delete-btn"
                          type="button"
                          onClick={() => deleteSite(site)}
                        >
                          מחק אתר
                        </button>
                      )}
                      <button
                        className="archive-btn"
                        type="button"
                        onClick={() => toggleSiteArchive(site)}
                      >
                        {site.archived ? "שחזר" : "ארכיון"}
                      </button>
                    </div>
                  }
                >
                  {siteBuildings.length === 0 ? (
                    <p className="empty-message">אין מבנים באתר הזה.</p>
                  ) : (
                    <div className="employees-compact-list">
                      {siteBuildings.map((building) => (
                        <CompactRow
                          key={building.id}
                          name={building.name}
                          archived={building.archived}
                          selected={selectedBuildingIds.includes(building.id)}
                          onToggleSelect={
                            isGeneralBuilding(building) ? undefined : () => toggleBuildingSelection(building.id)
                          }
                          onEdit={isGeneralBuilding(building) ? undefined : () => setEditingBuilding(building)}
                          onDelete={
                            isGeneralBuilding(building) || !advancedModeEnabled
                              ? undefined
                              : () => deleteBuilding(building)
                          }
                          onToggleArchive={
                            isGeneralBuilding(building) ? undefined : () => toggleBuildingArchive(building)
                          }
                        />
                      ))}
                    </div>
                  )}
                </GroupCard>
              );
            })}
          </div>
        )}
      </div>

      {orphanedBuildings.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <h3>מבנים ללא אתר</h3>
          <div className="employees-compact-list">
            {orphanedBuildings.map((building) => (
              <CompactRow
                key={building.id}
                name={building.name}
                archived={building.archived}
                selected={selectedBuildingIds.includes(building.id)}
                onToggleSelect={
                  isGeneralBuilding(building) ? undefined : () => toggleBuildingSelection(building.id)
                }
                onEdit={isGeneralBuilding(building) ? undefined : () => setEditingBuilding(building)}
                onDelete={
                  isGeneralBuilding(building) || !advancedModeEnabled
                    ? undefined
                    : () => deleteBuilding(building)
                }
                onToggleArchive={
                  isGeneralBuilding(building) ? undefined : () => toggleBuildingArchive(building)
                }
              />
            ))}
          </div>
        </div>
      )}

      {editingSite && (
        <EditSimpleItemModal
          title="עריכת אתר עבודה"
          initialName={editingSite.name}
          onSave={(newName) => updateItem("sites", editingSite.id, { name: newName })}
          onClose={() => setEditingSite(null)}
        />
      )}

      {editingBuilding && (
        <EditSimpleItemModal
          title="עריכת מבנה"
          initialName={editingBuilding.name}
          validate={(newName) =>
            newName === GENERAL_BUILDING_NAME
              ? `השם "${GENERAL_BUILDING_NAME}" שמור למבנה ברירת המחדל של האתר.`
              : null
          }
          onSave={(newName) => updateItem("buildings", editingBuilding.id, { name: newName })}
          onClose={() => setEditingBuilding(null)}
        />
      )}
    </>
  );
}
