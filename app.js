loadData()
  .then(() => {
    renderDashboard();
  })
  .catch(error => {
    console.error(
      "שגיאה בהפעלת המערכת:",
      error
    );
  });

const content = document.getElementById("content");
const pageTitle = document.getElementById("pageTitle");
const navButtons = document.querySelectorAll(".nav-btn");

navButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    navButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    showPage(btn.dataset.page);
  });
});

function showPage(page) {
  if (page === "dashboard") {
    renderDashboard();
  }

  if (page === "worklog") {
    renderWorkLogPage();
  }

  if (page === "reports") {
    renderReportsPage();
  }

  if (page === "employees") {
    renderEmployeesPage();
  }

  if (page === "sites") {
    renderSimpleManager(
      "sites",
      "אתרי עבודה",
      "שם אתר"
    );
  }

  if (page === "buildings") {
    renderBuildingsPage();
  }

  if (page === "customers") {
    renderSimpleManager(
      "customers",
      "מזמיני עבודה",
      "שם מזמין"
    );
  }
}

function getName(list, id) {
  const item = list.find(x => String(x.id) === String(id));
  return item ? item.name : "";
}

function getEmployeeNames(log) {
  return getEmployeeIds(log)
    .map(id => {
      const employee = appData.employees.find(
        e => String(e.id) === String(id)
      );

      return employee ? employee.name : "";
    })
    .filter(Boolean)
    .join(", ");
}

function getEmployeeIds(log) {
  if (!log.employeeIds) {
    return log.employeeId ? [String(log.employeeId)] : [];
  }

  const value = String(log.employeeIds).trim();

  try {
    const parsed = JSON.parse(value);

    if (Array.isArray(parsed)) {
      return parsed.map(id => String(id).trim()).filter(Boolean);
    }
  } catch (error) {
    // תמיכה ברשומות הישנות שנשמרו עם פסיקים
  }

  return value
    .split(",")
    .map(id => id.trim())
    .filter(Boolean);
}

function getReportEmployees(log) {
  const selectedGroup =
    document.getElementById("reportEmployeeGroup")?.value || "";

  const selectedSubcontractorId =
    document.getElementById("reportSubcontractor")?.value || "";

  const selectedEmployeeId =
    document.getElementById("reportEmployee")?.value || "";

  const employeeIds = getEmployeeIds(log);

  return appData.employees.filter(employee => {
    const existsInLog =
      employeeIds.includes(String(employee.id));

    const isInternal =
      employee.type === "internal";

    const isSubcontractorEmployee =
      employee.type === "subcontractor" ||
      employee.type === "external";

    let matchesGroup = true;

    if (selectedGroup === "internal") {
      matchesGroup = isInternal;
    }

    if (selectedGroup === "all-subcontractors") {
      matchesGroup = isSubcontractorEmployee;
    }

    const matchesSubcontractor =
      !selectedSubcontractorId ||
      String(employee.subcontractorId || "") ===
        String(selectedSubcontractorId);

    const matchesEmployee =
      !selectedEmployeeId ||
      String(employee.id) ===
        String(selectedEmployeeId);

    return (
      existsInLog &&
      matchesGroup &&
      matchesSubcontractor &&
      matchesEmployee
    );
  });
}

function getEmployeeAffiliationName(employee) {
  if (employee.type === "internal") {
    return "עובד שלי";
  }

  return (
    getName(
      appData.subcontractors,
      employee.subcontractorId
    ) || "ללא קבלן"
  );
}

function getReportAffiliationNames(log) {
  const reportEmployees = getReportEmployees(log);

  const names = reportEmployees.map(employee =>
    getEmployeeAffiliationName(employee)
  );

  return [...new Set(names)].join(", ");
}
function renderDashboard() {
  pageTitle.innerText = "סקירה כללית";

  content.innerHTML = `
    <div class="cards">
      <div class="card">
        <h3>עובדים</h3>
        <p>${appData.employees.length}</p>
      </div>

      <div class="card">
        <h3>קבלני משנה</h3>
        <p>${appData.subcontractors.length}</p>
      </div>

      <div class="card">
        <h3>אתרי עבודה</h3>
        <p>${appData.sites.length}</p>
      </div>

      <div class="card">
        <h3>מבנים</h3>
        <p>${appData.buildings.length}</p>
      </div>

      <div class="card">
        <h3>מזמיני עבודה</h3>
        <p>${appData.customers.length}</p>
      </div>

      <div class="card">
        <h3>רשומות יומן</h3>
        <p>${appData.workLogs.length}</p>
      </div>
    </div>
  `;
}


function addSubcontractor() {
  const input =
    document.getElementById("subcontractorName");

  const name = input?.value.trim() || "";

  if (!name) {
    alert("נא להזין שם קבלן משנה");
    return;
  }

  const alreadyExists =
    appData.subcontractors.some(subcontractor =>
      subcontractor.name.trim().toLowerCase() ===
      name.toLowerCase()
    );

  if (alreadyExists) {
    alert("קבלן משנה בשם הזה כבר קיים");
    return;
  }

  appData.subcontractors.push({
    id: generateId(),
    name
  });

  saveData();
  renderEmployeesPage();
}

function deleteSubcontractor(id) {
  const relatedEmployees =
    appData.employees.filter(employee =>
      String(employee.subcontractorId || "") ===
      String(id)
    );

  if (relatedEmployees.length > 0) {
    alert(
      `לא ניתן למחוק את הקבלן. משויכים אליו ${relatedEmployees.length} עובדים.`
    );
    return;
  }

  const confirmed = confirm(
    "האם למחוק את קבלן המשנה?"
  );

  if (!confirmed) {
    return;
  }

  appData.subcontractors =
    appData.subcontractors.filter(
      subcontractor =>
        String(subcontractor.id) !== String(id)
    );

  saveData();
  renderEmployeesPage();
}

function renderSimpleManager(type, title, placeholder) {
  pageTitle.innerText = title;
  const items = appData[type];

  content.innerHTML = `
    <div class="card">
      <h3>הוספה</h3>
      <input id="newItemInput" placeholder="${placeholder}" />
      <button class="primary-btn" onclick="addSimpleItem('${type}')">הוסף</button>
    </div>

    <div class="card" style="margin-top:20px;">
      <h3>רשימה קיימת</h3>
      ${
        items.length === 0 ? `<p>אין עדיין נתונים</p>` : `
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>שם</th>
              <th>פעולות</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${item.name}</td>
                <td><button onclick="deleteSimpleItem('${type}', '${item.id}')">מחק</button></td>
              </tr>
            `).join("")}
          </tbody>
        </table>`
      }
    </div>
  `;
}

function addSimpleItem(type) {
  const input = document.getElementById("newItemInput");
  const name = input.value.trim();

  if (!name) {
    alert("נא להזין שם");
    return;
  }

  const item = { id: generateId(), name };

  appData[type].push(item);
  saveData();

  showPage(type);
}

function renderEmployeesPage() {
  pageTitle.innerText = "עובדים וקבלני משנה";

  const internalEmployees = appData.employees.filter(employee =>
    employee.type === "internal"
  );

  const subcontractorEmployees = appData.employees.filter(employee =>
    employee.type === "subcontractor" ||
    employee.type === "external"
  );

  const totalEmployees = appData.employees.length;

  content.innerHTML = `
    <div class="cards">
      <div class="card">
        <h3>עובדים שלי</h3>
        <p>${internalEmployees.length}</p>
      </div>

      <div class="card">
        <h3>עובדי קבלן</h3>
        <p>${subcontractorEmployees.length}</p>
      </div>

      <div class="card">
        <h3>סה״כ עובדים</h3>
        <p>${totalEmployees}</p>
      </div>

      <div class="card">
        <h3>קבלני משנה</h3>
        <p>${appData.subcontractors.length}</p>
      </div>
    </div>

    <div class="card" style="margin-top:20px;">
      <h3>הוספת עובד</h3>

      <label>שם עובד</label>
      <input
        id="employeeName"
        placeholder="שם עובד"
      />

      <label>שיוך עובד</label>
      <select
        id="employeeType"
        onchange="updateEmployeeSubcontractorField()"
      >
        <option value="internal">
          עובד שלי
        </option>

        <option value="subcontractor">
          עובד קבלן משנה
        </option>
      </select>

      <div
        id="employeeSubcontractorSection"
        class="hidden"
      >
        <label>קבלן משנה</label>

        <select id="employeeSubcontractor">
          <option value="">
            בחר קבלן משנה
          </option>

          ${appData.subcontractors.map(subcontractor => `
            <option value="${subcontractor.id}">
              ${subcontractor.name}
            </option>
          `).join("")}
        </select>

        ${
          appData.subcontractors.length === 0
            ? `
              <p>
                עדיין אין קבלני משנה.
                הוסף קודם קבלן משנה באזור הבא.
              </p>
            `
            : ""
        }
      </div>

      <button
        class="primary-btn"
        type="button"
        onclick="addEmployee()"
      >
        הוסף עובד
      </button>
    </div>

    <div class="card" style="margin-top:20px;">
      <h3>הוספת קבלן משנה</h3>

      <label>שם קבלן משנה</label>
      <input
        id="subcontractorName"
        placeholder="שם קבלן המשנה"
      />

      <button
        class="primary-btn"
        type="button"
        onclick="addSubcontractor()"
      >
        הוסף קבלן משנה
      </button>
    </div>

    <div class="card" style="margin-top:20px;">
      <h3>
        העובדים שלי
        - סה״כ ${internalEmployees.length}
      </h3>

      ${
        internalEmployees.length === 0
          ? `<p>אין עדיין עובדים שלי.</p>`
          : createEmployeeTable(internalEmployees)
      }
    </div>

    ${appData.subcontractors.map(subcontractor => {
      const employees = appData.employees.filter(employee =>
        String(employee.subcontractorId || "") ===
        String(subcontractor.id)
      );

      return `
        <div class="card" style="margin-top:20px;">
          <div
            style="
              display:flex;
              justify-content:space-between;
              align-items:center;
              gap:10px;
              flex-wrap:wrap;
            "
          >
            <h3>
              ${subcontractor.name}
              - סה״כ ${employees.length}
            </h3>

            <button
              type="button"
              onclick="deleteSubcontractor('${subcontractor.id}')"
            >
              מחק קבלן
            </button>
          </div>

          ${
            employees.length === 0
              ? `<p>אין עובדים המשויכים לקבלן הזה.</p>`
              : createEmployeeTable(employees)
          }
        </div>
      `;
    }).join("")}

    ${
      subcontractorEmployees.some(employee =>
        !employee.subcontractorId
      )
        ? `
          <div class="card" style="margin-top:20px;">
            <h3>עובדי קבלן שלא שויכו לקבלן</h3>

            ${createEmployeeTable(
              subcontractorEmployees.filter(employee =>
                !employee.subcontractorId
              )
            )}
          </div>
        `
        : ""
    }

    <div class="card" style="margin-top:20px;">
      <h3>סיכום עובדים</h3>

      <p>
        עובדים שלי:
        <strong>${internalEmployees.length}</strong>
      </p>

      <p>
        עובדי קבלני משנה:
        <strong>${subcontractorEmployees.length}</strong>
      </p>

      <p>
        סה״כ עובדים כללי:
        <strong>${totalEmployees}</strong>
      </p>
    </div>
  `;

  updateEmployeeSubcontractorField();
}

function createEmployeeTable(employees) {
  return `
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>שם עובד</th>
          <th>פעולות</th>
        </tr>
      </thead>

      <tbody>
        ${employees.map((employee, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${employee.name}</td>

            <td>
              <button
                type="button"
                onclick="deleteEmployee('${employee.id}')"
              >
                מחק
              </button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function updateEmployeeSubcontractorField() {
  const employeeType =
    document.getElementById("employeeType");

  const section =
    document.getElementById(
      "employeeSubcontractorSection"
    );

  if (!employeeType || !section) {
    return;
  }

  if (employeeType.value === "subcontractor") {
    section.classList.remove("hidden");
  } else {
    section.classList.add("hidden");

    const subcontractorSelect =
      document.getElementById(
        "employeeSubcontractor"
      );

    if (subcontractorSelect) {
      subcontractorSelect.value = "";
    }
  }
}

function addEmployee() {
  const name =
    document
      .getElementById("employeeName")
      .value
      .trim();

  const type =
    document.getElementById("employeeType").value;

  const subcontractorId =
    document.getElementById(
      "employeeSubcontractor"
    )?.value || "";

  if (!name) {
    alert("נא להזין שם עובד");
    return;
  }

  if (
    type === "subcontractor" &&
    !subcontractorId
  ) {
    alert("נא לבחור קבלן משנה");
    return;
  }

  const employee = {
    id: generateId(),
    name,
    type,
    subcontractorId:
      type === "subcontractor"
        ? subcontractorId
        : ""
  };

  appData.employees.push(employee);
  saveData();

  renderEmployeesPage();
}


function deleteEmployee(id) {
  appData.employees = appData.employees.filter(employee => String(employee.id) !== String(id));
  saveData();

  renderEmployeesPage();
}

function deleteSimpleItem(type, id) {
  appData[type] = appData[type].filter(item => String(item.id) !== String(id));
  saveData();

  showPage(type);
}

function deleteBuilding(id) {
  appData.buildings = appData.buildings.filter(building => String(building.id) !== String(id));
  saveData();

  renderBuildingsPage();
}

function deleteWorkLog(id) {
  appData.workLogs = appData.workLogs.filter(log => String(log.id) !== String(id));
  saveData();

  renderWorkLogPage();
}

function renderBuildingsPage() {
  pageTitle.innerText = "מבנים";

  content.innerHTML = `
    <div class="card">
      <h3>הוספת מבנה</h3>

      <label>בחר אתר עבודה</label>
      <select id="buildingSite">
        <option value="">בחר אתר</option>
        ${appData.sites.map(site => `
          <option value="${site.id}">${site.name}</option>
        `).join("")}
      </select>

      <label>שם מבנה</label>
      <input id="buildingName" placeholder="לדוגמה: בניין א / קומה 2 / חניון" />

      <button class="primary-btn" onclick="addBuilding()">הוסף מבנה</button>
    </div>

    <div class="card" style="margin-top:20px;">
      <h3>רשימת מבנים</h3>
      ${
        appData.buildings.length === 0 ? `<p>אין עדיין מבנים</p>` : `
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>אתר עבודה</th>
              <th>מבנה</th>
              <th>פעולות</th>
            </tr>
          </thead>
          <tbody>
            ${appData.buildings.map((building, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${getName(appData.sites, building.siteId) || "אתר לא נמצא"}</td>
                <td>${building.name}</td>
                <td><button onclick="deleteBuilding('${building.id}')">מחק</button></td>
              </tr>
            `).join("")}
          </tbody>
        </table>`
      }
    </div>
  `;
}

function addBuilding() {
  const siteId = document.getElementById("buildingSite").value;
  const name = document.getElementById("buildingName").value.trim();

  if (!siteId) {
    alert("נא לבחור אתר עבודה");
    return;
  }

  if (!name) {
    alert("נא להזין שם מבנה");
    return;
  }

  const building = { id: generateId(), siteId, name };

  appData.buildings.push(building);
  saveData();

  renderBuildingsPage();
}

function renderWorkLogPage() {
  pageTitle.innerText = "יומן עבודה";

  content.innerHTML = `
    <div class="card">
      <h3>הוספת רשומת עבודה</h3>

      <label>תאריך</label>
      <input id="logDate" type="date" />

      <h4>בחירת עובדים</h4>

      <label>סינון לפי שיוך</label>
      <select
        id="logEmployeeGroup"
        onchange="filterEmployees()"
      >
        <option value="">
          כל העובדים
        </option>

        <option value="internal">
          העובדים שלי
        </option>

        <option value="all-subcontractors">
          כל עובדי קבלני המשנה
        </option>

        ${appData.subcontractors.map(subcontractor => `
          <option value="${subcontractor.id}">
            ${subcontractor.name}
          </option>
        `).join("")}
      </select>

      <input
        id="employeeSearch"
        type="text"
        placeholder="🔍 חפש עובד..."
        onkeyup="filterEmployees()"
      />

      <div class="employee-actions">
        <button
          type="button"
          class="secondary-btn"
          onclick="selectAllEmployees()"
        >
          בחר הכל
        </button>

        <button
          type="button"
          class="secondary-btn"
          onclick="clearAllEmployees()"
        >
          נקה הכל
        </button>
      </div>

      <div
        id="logEmployeesBox"
        class="checkbox-list"
      >
        ${appData.employees.map(employee => {
          const isInternal =
            employee.type === "internal";

          const subcontractorName = getName(
            appData.subcontractors,
            employee.subcontractorId
          );

          return `
            <label
              class="checkbox-item"
              data-employee-type="${
                isInternal
                  ? "internal"
                  : "subcontractor"
              }"
              data-subcontractor-id="${
                employee.subcontractorId || ""
              }"
            >
              <input
                type="checkbox"
                name="logEmployees"
                value="${employee.id}"
              />

              <span>
                ${employee.name}
                ${
                  isInternal
                    ? "- עובד שלי"
                    : `- ${
                        subcontractorName ||
                        "ללא קבלן"
                      }`
                }
              </span>
            </label>
          `;
        }).join("")}
      </div>

      <p id="employeeCountText">
        סה״כ עובדים שנבחרו: 0
      </p>

      <label>אתר עבודה</label>
      <select
        id="logSite"
        onchange="updateBuildingOptions()"
      >
        <option value="">בחר אתר</option>

        ${appData.sites.map(site => `
          <option value="${site.id}">
            ${site.name}
          </option>
        `).join("")}
      </select>

      <div
        id="buildingsSection"
        class="buildings-section hidden"
      >
        <div class="section-title-row">
          <label>מבנים</label>

          <div class="building-actions">
            <button
              type="button"
              class="secondary-btn"
              onclick="selectAllBuildings()"
            >
              בחר הכל
            </button>

            <button
              type="button"
              class="secondary-btn"
              onclick="clearAllBuildings()"
            >
              נקה הכל
            </button>
          </div>
        </div>

        <input
          id="buildingSearch"
          type="text"
          placeholder="🔍 חפש מבנה..."
          onkeyup="filterBuildings()"
        />

        <div
          id="logBuildingsBox"
          class="checkbox-list"
        ></div>
      </div>

      <label>מזמין עבודה</label>
      <select id="logCustomer">
        <option value="">בחר מזמין</option>

        ${appData.customers.map(customer => `
          <option value="${customer.id}">
            ${customer.name}
          </option>
        `).join("")}
      </select>

      <label>הערות</label>
      <textarea
        id="logNotes"
        placeholder="אופציונלי"
      ></textarea>

      <button
        class="primary-btn"
        type="button"
        onclick="addWorkLog()"
      >
        הוסף ליומן
      </button>
    </div>

    <div
      class="card"
      style="margin-top:20px;"
    >
      <h3>רשומות יומן</h3>

      ${
        appData.workLogs.length === 0
          ? `<p>אין עדיין רשומות</p>`
          : `
            <table>
              <thead>
                <tr>
                  <th>תאריך</th>
                  <th>עובדים</th>
                  <th>סה״כ עובדים</th>
                  <th>אתר</th>
                  <th>מבנה</th>
                  <th>מזמין</th>
                  <th>הערות</th>
                  <th>פעולות</th>
                </tr>
              </thead>

              <tbody>
                ${appData.workLogs.map(log => {
                  const employeeNames =
                    getEmployeeNames(log);

                  return `
                    <tr>
                      <td>
                        ${String(log.date).split("T")[0]}
                      </td>

                      <td>
                        ${employeeNames}
                      </td>

                      <td>
                        ${log.employeeCount || 1}
                      </td>

                      <td>
                        ${getName(
                          appData.sites,
                          log.siteId
                        )}
                      </td>

                      <td>
                        ${getBuildingNames(log)}
                      </td>

                      <td>
                        ${getName(
                          appData.customers,
                          log.customerId
                        )}
                      </td>

                      <td>
                        ${log.notes || ""}
                      </td>

                      <td>
                        <button
                          type="button"
                          onclick="deleteWorkLog('${log.id}')"
                        >
                          מחק
                        </button>
                      </td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          `
      }
    </div>
  `;

  const dateInput =
    document.getElementById("logDate");

  if (dateInput) {
    dateInput.value =
      new Date().toISOString().split("T")[0];
  }

  document
    .querySelectorAll(
      'input[name="logEmployees"]'
    )
    .forEach(input => {
      input.addEventListener(
        "change",
        updateEmployeeCountText
      );
    });

  updateEmployeeCountText();
}

function selectAllEmployees() {
  document
    .querySelectorAll('input[name="logEmployees"]')
    .forEach(checkbox => {
      const item = checkbox.closest(".checkbox-item");

      if (item && getComputedStyle(item).display !== "none") {
        checkbox.checked = true;
      }
    });

  updateEmployeeCountText();
}

function clearAllEmployees() {
  document
    .querySelectorAll('input[name="logEmployees"]')
    .forEach(checkbox => {
      checkbox.checked = false;
    });

  updateEmployeeCountText();
}

function filterEmployees() {
  const searchText =
    document
      .getElementById("employeeSearch")
      ?.value
      .trim()
      .toLowerCase() || "";

  const selectedGroup =
    document
      .getElementById("logEmployeeGroup")
      ?.value || "";

  document
    .querySelectorAll(
      "#logEmployeesBox .checkbox-item"
    )
    .forEach(item => {
      const employeeName =
        item.innerText.toLowerCase();

      const employeeType =
        item.dataset.employeeType || "";

      const subcontractorId =
        item.dataset.subcontractorId || "";

      const matchesSearch =
        !searchText ||
        employeeName.includes(searchText);

      let matchesGroup = true;

      if (selectedGroup === "internal") {
        matchesGroup =
          employeeType === "internal";
      } else if (
        selectedGroup ===
        "all-subcontractors"
      ) {
        matchesGroup =
          employeeType === "subcontractor";
      } else if (selectedGroup) {
        matchesGroup =
          String(subcontractorId) ===
          String(selectedGroup);
      }

      item.style.display =
        matchesSearch && matchesGroup
          ? "flex"
          : "none";
    });
}

function filterBuildings() {
  const text = document
    .getElementById("buildingSearch")
    .value
    .toLowerCase();

  document
    .querySelectorAll('#logBuildingsBox .checkbox-item')
    .forEach(item => {
      const name = item.innerText.toLowerCase();
      item.style.display = name.includes(text) ? "flex" : "none";
    });
}
function updateBuildingOptions() {
  const siteId = document.getElementById("logSite").value;
  const buildingsSection = document.getElementById("buildingsSection");
  const buildingBox = document.getElementById("logBuildingsBox");
  const search = document.getElementById("buildingSearch");

  if (search) {
    search.value = "";
  }  

  if (!siteId) {
    buildingsSection.classList.add("hidden");
    buildingBox.innerHTML = "";
    return;
  }

  buildingsSection.classList.remove("hidden");

  const buildings = appData.buildings.filter(
    building => String(building.siteId) === String(siteId)
  );

  if (buildings.length === 0) {
    buildingBox.innerHTML = `
      <div class="empty-message">
        אין מבנים באתר הזה
      </div>
    `;
    return;
  }

  buildingBox.innerHTML = buildings.map(building => `
    <label class="checkbox-item">
      <input
        type="checkbox"
        name="logBuildings"
        value="${building.id}"
      />
      <span>${building.name}</span>
    </label>
  `).join("");
}

function selectAllBuildings() {
  document
    .querySelectorAll('input[name="logBuildings"]')
    .forEach(checkbox => {
      const item = checkbox.closest(".checkbox-item");

      if (item && getComputedStyle(item).display !== "none") {
        checkbox.checked = true;
      }
    });
}

function clearAllBuildings() {
  document
    .querySelectorAll('input[name="logBuildings"]')
    .forEach(checkbox => {
      checkbox.checked = false;
    });
}

function addWorkLog() {
  const date = document.getElementById("logDate").value;
  const selectedEmployees = Array.from(
    document.querySelectorAll('input[name="logEmployees"]:checked')
  ).map(input => input.value);

  const employeeIds = JSON.stringify(selectedEmployees);
  const employeeCount = selectedEmployees.length;
  const siteId = document.getElementById("logSite").value;
  const selectedBuildings = Array.from(
  document.querySelectorAll('input[name="logBuildings"]:checked')
  ).map(input => input.value);

  const buildingIds = JSON.stringify(selectedBuildings);
  const customerId = document.getElementById("logCustomer").value;
  const notes = document.getElementById("logNotes").value.trim();

  if (!date || employeeCount === 0 || !siteId || selectedBuildings.length === 0 || !customerId) {
    alert("נא למלא תאריך, עובד, אתר, מבנה ומזמין");
    return;
  }

  const workLog = {
    id: generateId(),
    date,
    employeeId: selectedEmployees[0],
    employeeIds,
    employeeCount,
    siteId,
    buildingId: selectedBuildings[0],
    buildingIds,
    customerId,
    notes
  };

  appData.workLogs.push(workLog);
  saveData();

  renderWorkLogPage();
  
}

function getBuildingIds(log) {
  if (!log.buildingIds) {
    return log.buildingId ? [String(log.buildingId)] : [];
  }

  const value = String(log.buildingIds).trim();

  try {
    const parsed = JSON.parse(value);

    if (Array.isArray(parsed)) {
      return parsed.map(id => String(id).trim()).filter(Boolean);
    }
  } catch (error) {
    // תמיכה ברשומות ישנות
  }

  return value
    .split(",")
    .map(id => id.trim())
    .filter(Boolean);
}

function getBuildingNames(log) {
  return getBuildingIds(log)
    .map(id => getName(appData.buildings, id))
    .filter(Boolean)
    .join(", ");
}

function updateEmployeeCountText() {

  const count = document.querySelectorAll('input[name="logEmployees"]:checked').length;

  const el = document.getElementById("employeeCountText");

  if (el) {

    el.innerText = `סה״כ עובדים: ${count}`;

  }

}

function renderReportsPage() {
  pageTitle.innerText = "דוחות PDF / Excel";
  content.innerHTML = `
    <div class="card">
      <h3>סינון דוח</h3>
      <label>מתאריך</label>
      <input id="reportFrom" type="date" />
      <label>עד תאריך</label>
      <input id="reportTo" type="date" />
      <label>שיוך עובדים</label>
      <select
        id="reportEmployeeGroup"
        onchange="updateReportEmployeeOptions()"
      >
        <option value="">
          כל העובדים
        </option>
        <option value="internal">
          העובדים שלי
        </option>
        <option value="all-subcontractors">
          כל עובדי קבלני המשנה
        </option>
      </select>
      <label>קבלן משנה</label>
      <select
        id="reportSubcontractor"
        onchange="updateReportEmployeeOptions()"
      >
        <option value="">
          כל קבלני המשנה
        </option>
        ${appData.subcontractors.map(subcontractor => `
          <option value="${subcontractor.id}">
            ${subcontractor.name}
          </option>
        `).join("")}
      </select>
      <label>עובד</label>
      <select id="reportEmployee">
        <option value="">
          כל העובדים
        </option>
        ${appData.employees.map(employee => `
          <option value="${employee.id}">
            ${employee.name}
          </option>
        `).join("")}
      </select>
      <label>אתר עבודה</label>
      <select id="reportSite">
        <option value="">
          כל האתרים
        </option>
        ${appData.sites.map(site => `
          <option value="${site.id}">
            ${site.name}
          </option>
        `).join("")}
      </select>
      <label>מזמין עבודה</label>
      <select id="reportCustomer">
        <option value="">
          כל המזמינים
        </option>
        ${appData.customers.map(customer => `
          <option value="${customer.id}">
            ${customer.name}
          </option>
        `).join("")}
      </select>
      <div style="margin-top:20px;">
        <button
          class="primary-btn"
          type="button"
          onclick="generateReport()"
        >
          הצג דוח
        </button>
        <button
          class="primary-btn"
          type="button"
          onclick="downloadReportPDF()"
          style="margin-right:10px;"
        >
          הפק PDF
        </button>
        <button
          class="primary-btn"
          type="button"
          onclick="exportToExcel()"
          style="margin-right:10px;"
        >
          ייצוא לאקסל
        </button>
      </div>
    </div>
    <div
      id="reportResult"
      class="card"
      style="margin-top:20px;"
    >
      <p>בחר סינון ולחץ הצג דוח.</p>
    </div>
  `;
  updateReportEmployeeOptions();
}
function updateReportEmployeeOptions() {
  const selectedGroup =
    document.getElementById("reportEmployeeGroup")?.value || "";
  const subcontractorSelect =
    document.getElementById("reportSubcontractor");
  const employeeSelect =
    document.getElementById("reportEmployee");
  if (!subcontractorSelect || !employeeSelect) {
    return;
  }
  if (selectedGroup === "internal") {
    subcontractorSelect.value = "";
    subcontractorSelect.disabled = true;
  } else {
    subcontractorSelect.disabled = false;
  }
  const selectedSubcontractorId =
    subcontractorSelect.value;
  const filteredEmployees =
    appData.employees.filter(employee => {
      const isInternal =
        employee.type === "internal";
      const isSubcontractorEmployee =
        employee.type === "subcontractor" ||
        employee.type === "external";
      let matchesGroup = true;
      if (selectedGroup === "internal") {
        matchesGroup = isInternal;
      }
      if (selectedGroup === "all-subcontractors") {
        matchesGroup = isSubcontractorEmployee;
      }
      const matchesSubcontractor =
        !selectedSubcontractorId ||
        String(employee.subcontractorId || "") ===
          String(selectedSubcontractorId);
      return (
        matchesGroup &&
        matchesSubcontractor
      );
    });
  employeeSelect.innerHTML = `
    <option value="">
      כל העובדים
    </option>
    ${filteredEmployees.map(employee => `
      <option value="${employee.id}">
        ${employee.name}
        - ${getEmployeeAffiliationName(employee)}
      </option>
    `).join("")}
  `;
}
function filterReportLogs() {
  const from =
    document.getElementById("reportFrom")?.value || "";
  const to =
    document.getElementById("reportTo")?.value || "";
  const siteId =
    document.getElementById("reportSite")?.value || "";
  const customerId =
    document.getElementById("reportCustomer")?.value || "";
  return appData.workLogs.filter(log => {
    const logDate =
      String(log.date || "").split("T")[0];
    const reportEmployees =
      getReportEmployees(log);
    return (
      (!from || logDate >= from) &&
      (!to || logDate <= to) &&
      (
        !siteId ||
        String(log.siteId) === String(siteId)
      ) &&
      (
        !customerId ||
        String(log.customerId) ===
          String(customerId)
      ) &&
      reportEmployees.length > 0
    );
  });
}
function generateReport() {
  const filteredLogs =
    filterReportLogs();
  const reportResult =
    document.getElementById("reportResult");
  reportResult.innerHTML = `
    <h2>דוח יומן עבודה</h2>
    <p>
      סה״כ רשומות:
      ${filteredLogs.length}
    </p>
    ${
      filteredLogs.length === 0
        ? `<p>אין רשומות מתאימות.</p>`
        : `
          <table>
            <thead>
              <tr>
                <th>תאריך</th>
                <th>עובדים</th>
                <th>שיוך / קבלן</th>
                <th>סה״כ עובדים</th>
                <th>אתר</th>
                <th>מבנה</th>
                <th>מזמין</th>
                <th>הערות</th>
              </tr>
            </thead>
            <tbody>
              ${filteredLogs.map(log => {
                const reportEmployees =
                  getReportEmployees(log);
                const employeeNames =
                  reportEmployees
                    .map(employee => employee.name)
                    .join(", ");
                const affiliationNames =
                  getReportAffiliationNames(log);
                return `
                  <tr>
                    <td>
                      ${String(log.date || "").split("T")[0]}
                    </td>
                    <td>
                      ${employeeNames}
                    </td>
                    <td>
                      ${affiliationNames}
                    </td>
                    <td>
                      ${reportEmployees.length}
                    </td>
                    <td>
                      ${getName(
                        appData.sites,
                        log.siteId
                      )}
                    </td>
                    <td>
                      ${getBuildingNames(log)}
                    </td>
                    <td>
                      ${getName(
                        appData.customers,
                        log.customerId
                      )}
                    </td>
                    <td>
                      ${log.notes || ""}
                    </td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        `
    }
  `;
}
function downloadReportPDF() {
  const filteredLogs =
    filterReportLogs();
  if (filteredLogs.length === 0) {
    alert("אין רשומות מתאימות להפקת PDF");
    return;
  }
  createWorkLogPDF(filteredLogs);
}

/* =========================================
   תפריט המבורגר למובייל
========================================= */

(() => {
  const mobileMenuToggle = document.getElementById("menuToggle");
  const mobileSidebar = document.querySelector(".sidebar");
  const mobileMenuOverlay = document.getElementById("menuOverlay");
  const mobileNavButtons = document.querySelectorAll(".sidebar .nav-btn");

  if (!mobileMenuToggle || !mobileSidebar || !mobileMenuOverlay) {
    console.error("רכיבי תפריט ההמבורגר לא נמצאו ב-HTML");
    return;
  }

  function openMobileMenu() {
    mobileSidebar.classList.add("open");
    mobileMenuOverlay.classList.add("open");

    mobileMenuToggle.textContent = "✕";
    mobileMenuToggle.setAttribute("aria-label", "סגירת תפריט");
    mobileMenuToggle.setAttribute("aria-expanded", "true");
  }

  function closeMobileMenu() {
    mobileSidebar.classList.remove("open");
    mobileMenuOverlay.classList.remove("open");

    mobileMenuToggle.textContent = "☰";
    mobileMenuToggle.setAttribute("aria-label", "פתיחת תפריט");
    mobileMenuToggle.setAttribute("aria-expanded", "false");
  }

  mobileMenuToggle.addEventListener("click", () => {
    const isOpen = mobileSidebar.classList.contains("open");

    if (isOpen) {
      closeMobileMenu();
    } else {
      openMobileMenu();
    }
  });

  mobileMenuOverlay.addEventListener("click", closeMobileMenu);

  mobileNavButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (window.innerWidth <= 900) {
        closeMobileMenu();
      }
    });
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 900) {
      closeMobileMenu();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMobileMenu();
    }
  });
})();

function exportToExcel() {
  if (typeof XLSX === "undefined") {
    alert(
      "ספריית Excel לא נטענה. בדוק שהוספת את ספריית XLSX לקובץ index.html."
    );
    return;
  }

  const filteredLogs =
    filterReportLogs();

  if (filteredLogs.length === 0) {
    alert("אין נתונים לייצוא");
    return;
  }

  const excelData =
    filteredLogs.map(log => {
      const reportEmployees =
        getReportEmployees(log);

      const employeeNames =
        reportEmployees
          .map(employee => employee.name)
          .join(", ");

      const affiliationNames =
        getReportAffiliationNames(log);

      return {
        "תאריך":
          String(log.date || "").split("T")[0],

        "עובדים":
          employeeNames,

        "שיוך / קבלן משנה":
          affiliationNames,

        "סה״כ עובדים":
          reportEmployees.length,

        "אתר עבודה":
          getName(
            appData.sites,
            log.siteId
          ),

        "מבנים":
          getBuildingNames(log),

        "מזמין עבודה":
          getName(
            appData.customers,
            log.customerId
          ),

        "הערות":
          log.notes || ""
      };
    });

  const worksheet =
    XLSX.utils.json_to_sheet(excelData);

  worksheet["!cols"] = [
    { wch: 14 },
    { wch: 35 },
    { wch: 30 },
    { wch: 14 },
    { wch: 25 },
    { wch: 35 },
    { wch: 25 },
    { wch: 45 }
  ];

  worksheet["!autofilter"] = {
    ref: worksheet["!ref"]
  };

  const workbook =
    XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    "יומן עבודה"
  );

  const today =
    new Date()
      .toISOString()
      .split("T")[0];

  XLSX.writeFile(
    workbook,
    `יומן_עבודה_${today}.xlsx`
  );
}