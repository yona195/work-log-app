const API_URL = "https://script.google.com/macros/s/AKfycbz5zDU5ttTDDnGIKDJayHxu4W5pXh5VLw7SNHYj-uA-9AEFqevg7TXoEYtOPI6pL974/exec";

const STORAGE_KEY = "work_log_app_data";
const DIRTY_KEY = "work_log_has_unsaved_changes";

let appData = {
  employees: [],
  sites: [],
  buildings: [],
  customers: [],
  workLogs: []
};

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
  markUnsaved();
}

async function loadData() {
  const localData = localStorage.getItem(STORAGE_KEY);

  if (localData) {
    appData = JSON.parse(localData);
    updateSyncStatus();
    return;
  }

  await loadFromCloud();
}

function generateId() {
  return Date.now().toString();
}

function hasUnsavedChanges() {
  return localStorage.getItem(DIRTY_KEY) === "true";
}

function markUnsaved() {
  localStorage.setItem(DIRTY_KEY, "true");
  updateSyncStatus();
}

function markSaved() {
  localStorage.setItem(DIRTY_KEY, "false");
  updateSyncStatus();
}

function updateSyncStatus() {
  const el = document.getElementById("syncStatus");
  if (!el) return;

  el.innerText = hasUnsavedChanges()
    ? "🟡 יש שינויים שלא נשמרו לענן"
    : "🟢 שמור בענן";
}

async function saveToCloud() {
  updateSyncStatus();

  await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "saveAll",
      data: appData
    })
  });

  markSaved();
  alert("הנתונים נשמרו ל-Google Sheets");
}

async function loadFromCloud() {
  const response = await fetch(`${API_URL}?action=getAll`);
  appData = await response.json();

  localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
  markSaved();

  if (typeof renderDashboard === "function") {
    renderDashboard();
  }
}

window.addEventListener("beforeunload", function (e) {
  if (hasUnsavedChanges()) {
    e.preventDefault();
    e.returnValue = "";
  }
});