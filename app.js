loadData().then(() => {
  renderDashboard();
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
  if (page === "dashboard") renderDashboard();
  if (page === "employees") renderEmployeesPage();
  if (page === "sites") renderSimpleManager("sites", "אתרי עבודה", "שם אתר");
  if (page === "customers") renderSimpleManager("customers", "מזמיני עבודה", "שם מזמין");
  if (page === "buildings") renderBuildingsPage();
  if (page === "worklog") renderWorkLogPage();
  if (page === "reports") renderReportsPage();
}

function getName(list, id) {
  const item = list.find(x => x.id === id);
  return item ? item.name : "";
}

function renderDashboard() {
  pageTitle.innerText = "דף ראשי";

  content.innerHTML = `
    <div class="cards">
      <div class="card"><h3>עובדים</h3><p>${appData.employees.length}</p></div>
      <div class="card"><h3>אתרי עבודה</h3><p>${appData.sites.length}</p></div>
      <div class="card"><h3>מבנים</h3><p>${appData.buildings.length}</p></div>
      <div class="card"><h3>מזמיני עבודה</h3><p>${appData.customers.length}</p></div>
      <div class="card"><h3>רשומות יומן</h3><p>${appData.workLogs.length}</p></div>
    </div>
  `;
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
  pageTitle.innerText = "עובדים";

  content.innerHTML = `
    <div class="card">
      <h3>הוספת עובד</h3>

      <label>שם עובד</label>
      <input id="employeeName" placeholder="שם עובד" />

      <label>סוג עובד</label>
      <select id="employeeType">
        <option value="internal">עובד שלי</option>
        <option value="external">עובד חיצוני</option>
      </select>

      <button class="primary-btn" onclick="addEmployee()">הוסף עובד</button>
    </div>

    <div class="card" style="margin-top:20px;">
      <h3>רשימת עובדים</h3>
      ${
        appData.employees.length === 0 ? `<p>אין עדיין עובדים</p>` : `
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>שם</th>
              <th>סוג עובד</th>
              <th>פעולות</th>
            </tr>
          </thead>
          <tbody>
            ${appData.employees.map((employee, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${employee.name}</td>
                <td>${employee.type === "external" ? "עובד חיצוני" : "עובד שלי"}</td>
                <td><button onclick="deleteEmployee('${employee.id}')">מחק</button></td>
              </tr>
            `).join("")}
          </tbody>
        </table>`
      }
    </div>
  `;
}

function addEmployee() {
  const name = document.getElementById("employeeName").value.trim();
  const type = document.getElementById("employeeType").value;

  if (!name) {
    alert("נא להזין שם עובד");
    return;
  }

  const employee = { id: generateId(), name, type };

  appData.employees.push(employee);
  saveData();

  renderEmployeesPage();
}

function deleteEmployee(id) {
  appData.employees = appData.employees.filter(employee => employee.id !== id);
  saveData();

  renderEmployeesPage();
}

function deleteSimpleItem(type, id) {
  appData[type] = appData[type].filter(item => item.id !== id);
  saveData();

  showPage(type);
}

function deleteBuilding(id) {
  appData.buildings = appData.buildings.filter(building => building.id !== id);
  saveData();

  renderBuildingsPage();
}

function deleteWorkLog(id) {
  appData.workLogs = appData.workLogs.filter(log => log.id !== id);
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

      <label>עובד</label>
      <select id="logEmployee">
        <option value="">בחר עובד</option>
        ${appData.employees.map(e => `<option value="${e.id}">${e.name}</option>`).join("")}
      </select>

      <label>אתר עבודה</label>
      <select id="logSite" onchange="updateBuildingOptions()">
        <option value="">בחר אתר</option>
        ${appData.sites.map(s => `<option value="${s.id}">${s.name}</option>`).join("")}
      </select>

      <label>מבנה</label>
      <select id="logBuilding">
        <option value="">בחר קודם אתר</option>
      </select>

      <label>מזמין עבודה</label>
      <select id="logCustomer">
        <option value="">בחר מזמין</option>
        ${appData.customers.map(c => `<option value="${c.id}">${c.name}</option>`).join("")}
      </select>

      <label>הערות</label>
      <textarea id="logNotes" placeholder="אופציונלי"></textarea>

      <button class="primary-btn" onclick="addWorkLog()">הוסף ליומן</button>
    </div>

    <div class="card" style="margin-top:20px;">
      <h3>רשומות יומן</h3>
      ${
        appData.workLogs.length === 0 ? `<p>אין עדיין רשומות</p>` : `
        <table>
          <thead>
            <tr>
              <th>תאריך</th>
              <th>עובד</th>
              <th>סוג עובד</th>
              <th>אתר</th>
              <th>מבנה</th>
              <th>מזמין</th>
              <th>הערות</th>
              <th>פעולות</th>
            </tr>
          </thead>
          <tbody>
            ${appData.workLogs.map(log => {
              const employee = appData.employees.find(e => e.id === log.employeeId);
              return `
                <tr>
                  <td>${log.date}</td>
                  <td>${employee ? employee.name : ""}</td>
                  <td>${employee?.type === "external" ? "עובד חיצוני" : "עובד שלי"}</td>
                  <td>${getName(appData.sites, log.siteId)}</td>
                  <td>${getName(appData.buildings, log.buildingId)}</td>
                  <td>${getName(appData.customers, log.customerId)}</td>
                  <td>${log.notes || ""}</td>
                  <td><button onclick="deleteWorkLog('${log.id}')">מחק</button></td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>`
      }
    </div>
  `;

  document.getElementById("logDate").value = new Date().toISOString().split("T")[0];
}

function updateBuildingOptions() {
  const siteId = document.getElementById("logSite").value;
  const buildingSelect = document.getElementById("logBuilding");
  const buildings = appData.buildings.filter(b => b.siteId === siteId);

  buildingSelect.innerHTML = `
    <option value="">בחר מבנה</option>
    ${buildings.map(b => `<option value="${b.id}">${b.name}</option>`).join("")}
  `;
}

function addWorkLog() {
  const date = document.getElementById("logDate").value;
  const employeeId = document.getElementById("logEmployee").value;
  const siteId = document.getElementById("logSite").value;
  const buildingId = document.getElementById("logBuilding").value;
  const customerId = document.getElementById("logCustomer").value;
  const notes = document.getElementById("logNotes").value.trim();

  if (!date || !employeeId || !siteId || !buildingId || !customerId) {
    alert("נא למלא תאריך, עובד, אתר, מבנה ומזמין");
    return;
  }

  const workLog = {
    id: generateId(),
    date,
    employeeId,
    siteId,
    buildingId,
    customerId,
    notes
  };

  appData.workLogs.push(workLog);
  saveData();

  renderWorkLogPage();
}

function renderReportsPage() {
  pageTitle.innerText = "דוחות PDF";

  content.innerHTML = `
    <div class="card">
      <h3>סינון דוח</h3>

      <label>מתאריך</label>
      <input id="reportFrom" type="date" />

      <label>עד תאריך</label>
      <input id="reportTo" type="date" />

      <label>סוג עובד</label>
      <select id="reportEmployeeType">
        <option value="">כל העובדים</option>
        <option value="internal">עובדים שלי</option>
        <option value="external">עובדים חיצוניים</option>
      </select>

      <label>עובד</label>
      <select id="reportEmployee">
        <option value="">כל העובדים</option>
        ${appData.employees.map(e => `<option value="${e.id}">${e.name}</option>`).join("")}
      </select>

      <label>אתר עבודה</label>
      <select id="reportSite">
        <option value="">כל האתרים</option>
        ${appData.sites.map(s => `<option value="${s.id}">${s.name}</option>`).join("")}
      </select>

      <label>מזמין עבודה</label>
      <select id="reportCustomer">
        <option value="">כל המזמינים</option>
        ${appData.customers.map(c => `<option value="${c.id}">${c.name}</option>`).join("")}
      </select>

      <button class="primary-btn" onclick="generateReport()">הצג דוח</button>
      <button class="primary-btn" onclick="downloadReportPDF()" style="margin-right:10px;">הפק PDF</button>
    </div>

    <div id="reportResult" class="card" style="margin-top:20px;">
      <p>בחר סינון ולחץ הצג דוח.</p>
    </div>
  `;
}

function filterReportLogs() {
  const from = document.getElementById("reportFrom").value;
  const to = document.getElementById("reportTo").value;
  const employeeType = document.getElementById("reportEmployeeType").value;
  const employeeId = document.getElementById("reportEmployee").value;
  const siteId = document.getElementById("reportSite").value;
  const customerId = document.getElementById("reportCustomer").value;

  return appData.workLogs.filter(log => {
    const employee = appData.employees.find(e => e.id === log.employeeId);

    return (
      (!from || log.date >= from) &&
      (!to || log.date <= to) &&
      (!employeeType || employee?.type === employeeType) &&
      (!employeeId || log.employeeId === employeeId) &&
      (!siteId || log.siteId === siteId) &&
      (!customerId || log.customerId === customerId)
    );
  });
}

function generateReport() {
  const filtered = filterReportLogs();

  document.getElementById("reportResult").innerHTML = `
    <h2>דוח יומן עבודה</h2>
    <p>סה״כ רשומות: ${filtered.length}</p>

    ${
      filtered.length === 0 ? `<p>אין רשומות מתאימות.</p>` : `
      <table>
        <thead>
          <tr>
            <th>תאריך</th>
            <th>עובד</th>
            <th>סוג עובד</th>
            <th>אתר</th>
            <th>מבנה</th>
            <th>מזמין</th>
            <th>הערות</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(log => {
            const employee = appData.employees.find(e => e.id === log.employeeId);

            return `
              <tr>
                <td>${log.date}</td>
                <td>${employee ? employee.name : ""}</td>
                <td>${employee?.type === "external" ? "עובד חיצוני" : "עובד שלי"}</td>
                <td>${getName(appData.sites, log.siteId)}</td>
                <td>${getName(appData.buildings, log.buildingId)}</td>
                <td>${getName(appData.customers, log.customerId)}</td>
                <td>${log.notes || ""}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>`
    }
  `;
}

function downloadReportPDF() {
  const filtered = filterReportLogs();
  createWorkLogPDF(filtered);
}

