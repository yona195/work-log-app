// Friendly Hebrew toast copy for the generic add/update/delete mutation
// pipeline in DataProvider — one place to edit wording for every collection
// instead of writing a message at each call site across the app.

const ENTITY_LABELS = {
  subcontractors: "קבלן המשנה",
  sites: "אתר העבודה",
  customers: "מזמין העבודה",
  employees: "העובד",
  buildings: "המבנה",
  rates: "התעריף",
  workLogs: "רשומת העבודה",
};

// רשומת העבודה is the only feminine label above; the rest are masculine.
const FEMININE_COLLECTIONS = new Set(["workLogs"]);

const VERBS = {
  added: { m: "נוסף", f: "נוספה" },
  deleted: { m: "נמחק", f: "נמחקה" },
  updated: { m: "עודכן", f: "עודכנה" },
  archived: { m: "הועבר", f: "הועברה" },
  restored: { m: "שוחזר", f: "שוחזרה" },
};

const ERROR_VERB_NOUNS = {
  added: "בהוספת",
  deleted: "במחיקת",
  updated: "בעדכון",
  archived: "בהעברת",
  restored: "בשחזור",
};

function label(collection) {
  return ENTITY_LABELS[collection] || "הרשומה";
}

function gender(collection) {
  return FEMININE_COLLECTIONS.has(collection) ? "f" : "m";
}

function archiveSuffix(kind) {
  if (kind === "archived") return " לארכיון";
  if (kind === "restored") return " מהארכיון";
  return "";
}

export function getSuccessMessage(collection, kind) {
  const verb = VERBS[kind] || VERBS.updated;
  return `${label(collection)} ${verb[gender(collection)]}${archiveSuffix(kind)} בהצלחה`;
}

export function getErrorMessage(collection, kind, err) {
  const noun = ERROR_VERB_NOUNS[kind] || ERROR_VERB_NOUNS.updated;
  const detail = err && err.message ? `: ${err.message}` : "";
  return `שגיאה ${noun} ${label(collection)}${archiveSuffix(kind)}${detail}`;
}
