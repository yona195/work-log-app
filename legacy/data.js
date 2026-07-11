const API_URL =
  "https://script.google.com/macros/s/AKfycbz5zDU5ttTDDnGIKDJayHxu4W5pXh5VLw7SNHYj-uA-9AEFqevg7TXoEYtOPI6pL974/exec";

const STORAGE_KEY = "work_log_app_data";
const DIRTY_KEY = "work_log_has_unsaved_changes";

let cloudDataLoaded = false;
let cloudDataLoading = false;

let appData = {
  employees: [],
  subcontractors: [],
  sites: [],
  buildings: [],
  customers: [],
  rates: [],
  workLogs: []
};

/* =========================================
   שמירה מקומית
========================================= */

function saveData() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(appData)
  );

  markUnsaved();
}

function generateId() {
  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 9)}`;
}


/* =========================================
   מצב שמירה
========================================= */

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
  const statusElement =
    document.getElementById("syncStatus");

  if (!statusElement) {
    return;
  }

  if (cloudDataLoading) {
    statusElement.innerText =
      "🔄 טוען נתונים ...";
    return;
  }

  if (!cloudDataLoaded) {
    statusElement.innerText =
      "🔴 טעינת נתונים נכשלה";
    return;
  }

  statusElement.innerText = hasUnsavedChanges()
    ? "🟡 לא מסונכרן"
    : "🟢 מסונכרן";
}


/* =========================================
   מסך טעינה
========================================= */

function showLoadingScreen(
  message = "טוען נתונים ..."
) {
  const loadingScreen =
    document.getElementById("loadingScreen");

  const loadingText =
    document.getElementById("loadingText");

  document.body.classList.add("loading");

  if (loadingText) {
    loadingText.innerText = message;
  }

  if (loadingScreen) {
    loadingScreen.classList.remove("hidden");
  }
}

function hideLoadingScreen() {
  const loadingScreen =
    document.getElementById("loadingScreen");

  if (loadingScreen) {
    loadingScreen.classList.add("hidden");
  }

  document.body.classList.remove("loading");
}


/* =========================================
   טעינת הנתונים
========================================= */

async function loadData() {
  await loadFromCloud();
}

async function loadFromCloud() {
  cloudDataLoading = true;
  cloudDataLoaded = false;

  showLoadingScreen(
    "טוען נתונים ..."
  );

  updateSyncStatus();

  const controller =
    new AbortController();

  const timeoutId =
    setTimeout(() => {
      controller.abort();
    }, 15000);

  try {
    const response = await fetch(
      `${API_URL}?action=getAll&t=${Date.now()}`,
      {
        method: "GET",
        cache: "no-store",
        signal: controller.signal
      }
    );

    if (!response.ok) {
      throw new Error(
        `שגיאת שרת: ${response.status}`
      );
    }

    const cloudData =
      await response.json();

    const isValidData =
      cloudData &&
      Array.isArray(cloudData.employees) &&
      Array.isArray(cloudData.sites) &&
      Array.isArray(cloudData.buildings) &&
      Array.isArray(cloudData.customers) &&
      Array.isArray(cloudData.workLogs);

    if (!isValidData) {
      throw new Error(
        "מבנה הנתונים שהתקבל מהענן אינו תקין"
      );
    }

    appData = {
      employees:
        cloudData.employees,

      subcontractors:
        Array.isArray(cloudData.subcontractors)
          ? cloudData.subcontractors
          : [],

      sites:
        cloudData.sites,

      buildings:
        cloudData.buildings,

      customers:
        cloudData.customers,

      rates:
        Array.isArray(cloudData.rates)
          ? cloudData.rates
          : [],

      workLogs:
        cloudData.workLogs
    };
    
    cloudDataLoaded = true;

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(appData)
    );

    markSaved();

    hideLoadingScreen();
  } catch (error) {
    console.error(
      "טעינת הנתונים נכשלה:",
      error
    );

    cloudDataLoaded = false;

    const message =
      error.name === "AbortError"
        ? "הטעינה מהענן נמשכה זמן רב מדי. בדוק את החיבור או נסה לרענן."
        : "לא ניתן לטעון את הנתונים מהענן. בדוק את החיבור לאינטרנט ורענן את הדף.";

    showLoadingScreen(message);

    alert(
      "טעינת הנתונים מהענן נכשלה. המערכת והשמירה לענן נשארו חסומות כדי למנוע בעיות סנכרון."
    );
  } finally {
    clearTimeout(timeoutId);

    cloudDataLoading = false;
    updateSyncStatus();
  }
}
/* =========================================
   שמירה לענן
========================================= */

async function saveToCloud() {
  if (cloudDataLoading) {
    alert(
      "הנתונים עדיין נטענים. המתן לסיום הטעינה."
    );
    return;
  }

  if (!cloudDataLoaded) {
    alert(
      "הנתונים מהענן לא נטענו. השמירה נחסמה כדי למנוע מחיקה."
    );
    return;
  }

  const confirmed = confirm(
    "האם לשמור את הנתונים הנוכחיים ל-Google Sheets?"
  );

  if (!confirmed) {
    return;
  }

  try {
    const response = await fetch(API_URL, {
      method: "POST",

      body: JSON.stringify({
        action: "saveAll",
        data: appData
      })
    });

    if (!response.ok) {
      throw new Error(
        `שגיאת שרת: ${response.status}`
      );
    }

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(appData)
    );

    markSaved();

    alert(
      "הנתונים נשמרו ל-Google Sheets"
    );
  } catch (error) {
    console.error(
      "שמירת הנתונים נכשלה:",
      error
    );

    alert(
      "השמירה נכשלה. הנתונים לא נשלחו-Google Sheets."
    );
  }
}

/* =========================================
   אזהרה ביציאה
========================================= */

window.addEventListener(
  "beforeunload",
  function (event) {
    if (hasUnsavedChanges()) {
      event.preventDefault();
      event.returnValue = "";
    }
  }
);