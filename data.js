const STORAGE_KEY = "work_log_app_data";

let appData = {
  employees: [],
  sites: [],
  buildings: [],
  customers: [],
  workLogs: []
};

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
}

function loadData() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    appData = JSON.parse(saved);
  }
}

function generateId() {
  return Date.now().toString();
}
