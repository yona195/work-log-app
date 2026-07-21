import { useState } from "react";
import { useData } from "../state/DataProvider.jsx";
import { activeOnly, getBuildingIds } from "../lib/entities.js";
import EditSimpleItemModal from "../components/EditSimpleItemModal.jsx";
import EditBuildingModal from "../components/EditBuildingModal.jsx";
import GroupCard from "../components/GroupCard.jsx";
import CompactRow from "../components/CompactRow.jsx";

// The default building auto-created for every site (see server/src/db.js) —
// a fixed, protected name: no edit/delete/archive, and never assignable to
// a second, manually-created building (that would make "which building is
// actually the fallback?" ambiguous).
const GENERAL_BUILDING_NAME = "כללי";
const isGeneralBuilding = (building) => building.name === GENERAL_BUILDING_NAME;

export default function Sites() {
  const { data, addItem, updateItem, deleteItem } = useData();
  const { sites, buildings, workLogs } = data;

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
      !confirm(
        `להעביר את ${building.name} לארכיון? המבנה לא יופיע יותר לבחירה ברשומות חדשות, אבל הדוחות הקיימים לא ישתנו.`
      )
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
  // (date, employees, site, customer) stays exactly as it was.
  const deleteBuilding = async (building) => {
    if (isGeneralBuilding(building)) return; // no delete button reaches here anyway
    const generalBuilding = buildings.find(
      (b) => String(b.siteId) === String(building.siteId) && isGeneralBuilding(b)
    );
    const affectedLogs = workLogs.filter((log) =>
      getBuildingIds(log).map(String).includes(String(building.id))
    );

    const confirmMessage =
      affectedLogs.length > 0
        ? `למחוק את ${building.name} לצמיתות? ${affectedLogs.length} רשומות עבודה שמצביעות על המבנה הזה יעברו אוטומטית למבנה "${GENERAL_BUILDING_NAME}" של האתר - שאר נתוני הרשומות (תאריך, עובדים, אתר, מזמין) יישארו ללא שינוי.`
        : `למחוק את ${building.name} לצמיתות?`;
    if (!confirm(confirmMessage)) return;

    for (const log of affectedLogs) {
      const remainingIds = getBuildingIds(log)
        .map(String)
        .filter((id) => id !== String(building.id));
      const nextIds = generalBuilding && !remainingIds.includes(String(generalBuilding.id))
        ? [...remainingIds, generalBuilding.id]
        : remainingIds;
      // eslint-disable-next-line no-await-in-loop
      await updateItem("workLogs", log.id, { buildingIds: nextIds });
    }

    await deleteItem("buildings", building.id);
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
      !confirm(
        `להעביר את ${site.name}${buildingNote} לארכיון? לא יופיעו יותר לבחירה ברשומות חדשות, אבל הדוחות הקיימים לא ישתנו.`
      )
    ) {
      return;
    }
    await updateItem("sites", site.id, { archived: true });
    for (const building of siteBuildings) {
      // eslint-disable-next-line no-await-in-loop
      await updateItem("buildings", building.id, { archived: true });
    }
  };

  const deleteSite = async (site) => {
    const siteBuildings = buildingsOfSite(site);
    const buildingNote =
      siteBuildings.length > 0 ? ` וכל ${siteBuildings.length} המבנים שלו` : "";
    if (
      !confirm(
        `למחוק את ${site.name}${buildingNote} לצמיתות? בשונה מהעברה לארכיון, מחיקה תשפיע גם על דוחות והיסטוריה שכבר נרשמו.`
      )
    ) {
      return;
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
        {visibleSites.length === 0 ? (
          <p className="empty-message">אין עדיין אתרי עבודה.</p>
        ) : (
          <div className="employees-contractor-list">
            {visibleSites.map((site) => {
              const siteBuildings = visibleBuildings.filter(
                (b) => String(b.siteId || "") === String(site.id)
              );
              return (
                <GroupCard
                  key={site.id}
                  icon="location_city"
                  title={site.name}
                  count={siteBuildings.length}
                  countLabel="מבנים"
                  isArchived={site.archived}
                  groupActions={
                    <div className="report-row-actions">
                      <button
                        className="edit-btn"
                        type="button"
                        onClick={() => setEditingSite(site)}
                      >
                        ערוך אתר
                      </button>
                      <button
                        className="delete-btn"
                        type="button"
                        onClick={() => deleteSite(site)}
                      >
                        מחק אתר
                      </button>
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
                          name={
                            isGeneralBuilding(building)
                              ? `${building.name} (ברירת מחדל)`
                              : building.name
                          }
                          archived={building.archived}
                          onEdit={isGeneralBuilding(building) ? undefined : () => setEditingBuilding(building)}
                          onDelete={isGeneralBuilding(building) ? undefined : () => deleteBuilding(building)}
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
                name={isGeneralBuilding(building) ? `${building.name} (ברירת מחדל)` : building.name}
                archived={building.archived}
                onEdit={isGeneralBuilding(building) ? undefined : () => setEditingBuilding(building)}
                onDelete={isGeneralBuilding(building) ? undefined : () => deleteBuilding(building)}
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
        <EditBuildingModal
          building={editingBuilding}
          onClose={() => setEditingBuilding(null)}
        />
      )}
    </>
  );
}
