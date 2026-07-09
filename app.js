loadData();

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
  if (page === "employees") renderSimpleManager("employees", "עובדים", "שם עובד");
  if (page === "sites") renderSimpleManager("sites", "אתרי עבודה", "שם אתר");
  if (page === "customers") renderSimpleManager("customers", "מזמיני עבודה", "שם מזמין");
}

function renderDashboard() {
  pageTitle.innerText = "דף ראשי";

  content.innerHTML = `
    <div class="cards">
      <div class="card">
        <h3>עובדים</h3>
        <p>${appData.employees.length}</p>
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

function renderSimpleManager(type, title, placeholder) {
  pageTitle.innerText = title;

  const items = appData[type];

  content.innerHTML = `
    <div class="card">
      <h3>הוספה</h3>

      <input id="newItemInput" placeholder="${placeholder}" />

      <button class="primary-btn" onclick="addSimpleItem('${type}')">
        הוסף
      </button>
    </div>

    <div class="card" style="margin-top:20px;">
      <h3>רשימה קיימת</h3>

      ${
        items.length === 0
          ? `<p>אין עדיין נתונים</p>`
          : `
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>שם</th>
                  <th>פעולות</th>
                </tr>
              </thead>
              <tbody>
                ${items
                  .map(
                    (item, index) => `
                      <tr>
                        <td>${index + 1}</td>
                        <td>${item.name}</td>
                        <td>
                          <button onclick="deleteSimpleItem('${type}', '${item.id}')">
                            מחק
                          </button>
                        </td>
                      </tr>
                    `
                  )
                  .join("")}
              </tbody>
            </table>
          `
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

  appData[type].push({
    id: generateId(),
    name: name
  });

  saveData();
  renderSimpleManager(
    type,
    type === "employees" ? "עובדים" :
    type === "sites" ? "אתרי עבודה" :
    "מזמיני עבודה",
    type === "employees" ? "שם עובד" :
    type === "sites" ? "שם אתר" :
    "שם מזמין"
  );
}

function deleteSimpleItem(type, id) {
  appData[type] = appData[type].filter(item => item.id !== id);
  saveData();
  showPage(type);
}

renderDashboard();
