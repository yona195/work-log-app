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
let dashboardCharts = [];

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

  if (page === "rates") {
    renderRatesPage();
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

  const currentMonth =
    getCurrentMonthRange();

  content.innerHTML = `
    <div class="card dashboard-filter">
      <h3>תקופת הסקירה</h3>

      <label>בחר תקופה</label>

      <select
        id="dashboardPeriod"
        onchange="updateDashboardPeriodFields()"
      >
        <option value="current-month">
          החודש הנוכחי
        </option>

        <option value="previous-month">
          החודש הקודם
        </option>

        <option value="current-year">
          השנה הנוכחית
        </option>

        <option value="custom">
          טווח תאריכים
        </option>
      </select>

      <div
        id="dashboardCustomDates"
        class="hidden"
      >
        <label>מתאריך</label>

        <input
          id="dashboardFrom"
          type="date"
          value="${currentMonth.from}"
        />

        <label>עד תאריך</label>

        <input
          id="dashboardTo"
          type="date"
          value="${currentMonth.to}"
        />
      </div>

      <button
        type="button"
        class="primary-btn"
        onclick="refreshDashboard()"
      >
        הצג נתונים
      </button>
    </div>

    <div
      id="dashboardResults"
      style="margin-top:20px;"
    ></div>
  `;

  refreshDashboard();
}

function updateDashboardPeriodFields() {
  const selectedPeriod =
    document.getElementById(
      "dashboardPeriod"
    )?.value || "current-month";

  const customDates =
    document.getElementById(
      "dashboardCustomDates"
    );

  if (!customDates) {
    return;
  }

  if (selectedPeriod === "custom") {
    customDates.classList.remove("hidden");
  } else {
    customDates.classList.add("hidden");
  }
}

function getDashboardPeriodRange() {
  const selectedPeriod =
    document.getElementById(
      "dashboardPeriod"
    )?.value || "current-month";

  const now = new Date();

  const formatLocalDate = date => {
    const year =
      date.getFullYear();

    const month =
      String(
        date.getMonth() + 1
      ).padStart(2, "0");

    const day =
      String(
        date.getDate()
      ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  if (selectedPeriod === "previous-month") {
    const firstDay =
      new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        1
      );

    const lastDay =
      new Date(
        now.getFullYear(),
        now.getMonth(),
        0
      );

    return {
      from: formatLocalDate(firstDay),
      to: formatLocalDate(lastDay),
      label: "החודש הקודם"
    };
  }

  if (selectedPeriod === "current-year") {
    const year =
      now.getFullYear();

    return {
      from: `${year}-01-01`,
      to: `${year}-12-31`,
      label: `שנת ${year}`
    };
  }

  if (selectedPeriod === "custom") {
    const from =
      document.getElementById(
        "dashboardFrom"
      )?.value || "";

    const to =
      document.getElementById(
        "dashboardTo"
      )?.value || "";

    return {
      from,
      to,
      label:
        from && to
          ? `${from} עד ${to}`
          : "טווח מותאם"
    };
  }

  const currentMonth =
    getCurrentMonthRange();

  return {
    from: currentMonth.from,
    to: currentMonth.to,
    label: "החודש הנוכחי"
  };
}

function getLogsForPeriod(
  fromDate,
  toDate
) {
  const logs =
    Array.isArray(appData.workLogs)
      ? appData.workLogs
      : [];

  return logs.filter(log => {
    const logDate =
      normalizeDate(log.date);

    return (
      (!fromDate || logDate >= fromDate) &&
      (!toDate || logDate <= toDate)
    );
  });
}

function calculateFinanceByWorkforce(
  logs
) {
  const groups = {};

  logs.forEach(log => {
    const employeeIds =
      getEmployeeIds(log);

    employeeIds.forEach(employeeId => {
      const employee =
        appData.employees.find(item =>
          String(item.id) ===
          String(employeeId)
        );

      if (!employee) {
        return;
      }

      const rate =
        getApplicableRate(
          employee,
          log.siteId,
          log.date
        );

      if (!rate) {
        return;
      }

      let groupKey = "";
      let groupName = "";

      if (employee.type === "internal") {
        groupKey = "internal";
        groupName = "העובדים שלי";
      } else {
        groupKey =
          `subcontractor-${employee.subcontractorId}`;

        groupName =
          getName(
            appData.subcontractors,
            employee.subcontractorId
          ) || "קבלן לא ידוע";
      }

      if (!groups[groupKey]) {
        groups[groupKey] = {
          name: groupName,
          revenue: 0,
          cost: 0,
          profit: 0
        };
      }

      const revenue =
        Number(
          rate.revenuePerWorker
        ) || 0;

      const cost =
        Number(
          rate.costPerWorker
        ) || 0;

      groups[groupKey].revenue += revenue;
      groups[groupKey].cost += cost;
      groups[groupKey].profit +=
        revenue - cost;
    });
  });

  return Object.values(groups);
}

function calculateProfitBySite(logs) {
  const sites = {};

  logs.forEach(log => {
    const finance =
      calculateWorkLogFinance(log);

    const siteId =
      String(log.siteId || "");

    const siteName =
      getName(
        appData.sites,
        log.siteId
      ) || "אתר לא ידוע";

    if (!sites[siteId]) {
      sites[siteId] = {
        name: siteName,
        revenue: 0,
        cost: 0,
        profit: 0
      };
    }

    sites[siteId].revenue +=
      finance.revenue;

    sites[siteId].cost +=
      finance.cost;

    sites[siteId].profit +=
      finance.profit;
  });

  return Object.values(sites);
}

function getMissingRatesForLogs(logs) {
  const missingMap = new Map();

  logs.forEach(log => {
    const finance =
      calculateWorkLogFinance(log);

    finance.missingRateEmployees.forEach(
      employee => {
        const date =
          normalizeDate(log.date);

        const fullEmployee =
          appData.employees.find(item =>
            String(item.id) ===
            String(employee.employeeId)
          );

        let affiliationName =
          "שיוך לא ידוע";

        if (fullEmployee) {
          if (fullEmployee.type === "internal") {
            affiliationName =
              "עובד שלי";
          } else {
            affiliationName =
              getName(
                appData.subcontractors,
                fullEmployee.subcontractorId
              ) || "ללא קבלן";
          }
        }

        const key = [
          employee.employeeId,
          log.siteId,
          date
        ].join("-");

        if (!missingMap.has(key)) {
          missingMap.set(key, {
            employeeName:
              employee.employeeName,

            affiliationName,

            siteName:
              getName(
                appData.sites,
                log.siteId
              ) || "אתר לא ידוע",

            date
          });
        }
      }
    );
  });

  return Array.from(
    missingMap.values()
  );
}

function destroyDashboardCharts() {
  dashboardCharts.forEach(chart => {
    if (chart) {
      chart.destroy();
    }
  });

  dashboardCharts = [];
}

function refreshDashboard() {
  const results =
    document.getElementById(
      "dashboardResults"
    );

  if (!results) {
    return;
  }

  const period =
    getDashboardPeriodRange();

  if (
    period.from &&
    period.to &&
    period.from > period.to
  ) {
    alert(
      "תאריך ההתחלה לא יכול להיות מאוחר מתאריך הסיום"
    );
    return;
  }

  const logs =
    getLogsForPeriod(
      period.from,
      period.to
    );

  const totals =
    calculateFinanceForPeriod(
      period.from,
      period.to
    );

  const workforce =
    calculateFinanceByWorkforce(logs);

  const sites =
    calculateProfitBySite(logs);

  const missingRates =
    getMissingRatesForLogs(logs);

  destroyDashboardCharts();

  results.innerHTML = `
    <div class="card">
      <h3>
        סיכום כספי -
        ${period.label}
      </h3>

      <div class="cards">
        <div class="card">
          <h3>הכנסות</h3>

          <p>
            ${formatCurrency(totals.revenue)}
          </p>
        </div>

        <div class="card">
          <h3>הוצאות</h3>

          <p>
            ${formatCurrency(totals.cost)}
          </p>
        </div>

        <div class="card">
          <h3>רווח</h3>

          <p>
            ${formatCurrency(totals.profit)}
          </p>
        </div>
      </div>
    </div>

    <div
      class="card"
      style="margin-top:20px;"
    >
      <h3>
        הכנסות מול הוצאות לפי כוח אדם
      </h3>

      ${
        workforce.length === 0
          ? `
            <p class="dashboard-empty-text">
              אין נתונים מתאימים בתקופה שנבחרה.
            </p>
          `
          : `
            <div class="chart-container">
              <canvas
                id="workforceFinanceChart"
              ></canvas>
            </div>
          `
      }
    </div>

    <div
      class="card"
      style="margin-top:20px;"
    >
      <h3>
        רווח לפי אתר עבודה
      </h3>

      ${
        sites.length === 0
          ? `
            <p class="dashboard-empty-text">
              אין נתונים מתאימים בתקופה שנבחרה.
            </p>
          `
          : `
            <div class="chart-container">
              <canvas
                id="siteProfitChart"
              ></canvas>
            </div>
          `
      }
    </div>

    ${
      missingRates.length > 0
        ? `
          <div
            class="card missing-rates-card"
            style="margin-top:20px;"
          >
            <h3>
              ⚠️ חסרים תעריפים
            </h3>

            <p class="missing-rates-intro">
              העובדים הבאים לא נכללו במלואם
              בחישוב הכספי:
            </p>

            <table>
              <thead>
                <tr>
                  <th>עובד</th>
                  <th>שיוך / קבלן</th>
                  <th>אתר</th>
                  <th>תאריך</th>
                </tr>
              </thead>

              <tbody>
                ${missingRates.map(item => `
                  <tr>
                    <td>
                      ${item.employeeName}
                    </td>

                    <td>
                      ${item.affiliationName}
                    </td>

                    <td>
                      ${item.siteName}
                    </td>

                    <td dir="ltr">
                      ${item.date}
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        `
        : ""
    }
  `;

  renderWorkforceFinanceChart(
    workforce
  );

  renderSiteProfitChart(
    sites
  );
}

function renderWorkforceFinanceChart(
  groups
) {
  const canvas =
    document.getElementById(
      "workforceFinanceChart"
    );

  if (
    !canvas ||
    typeof Chart === "undefined" ||
    groups.length === 0
  ) {
    return;
  }

  const chart = new Chart(canvas, {
    type: "bar",

    data: {
      labels:
        groups.map(group =>
          group.name
        ),

      datasets: [
        {
          label: "הכנסות",
          data:
            groups.map(group =>
              group.revenue
            ),

          backgroundColor:
            "rgba(37, 99, 235, 0.75)"
        },

        {
          label: "הוצאות",
          data:
            groups.map(group =>
              group.cost
            ),

          backgroundColor:
            "rgba(239, 68, 68, 0.75)"
        }
      ]
    },

    options: {
      responsive: true,
      maintainAspectRatio: false,

      plugins: {
        legend: {
          position: "bottom"
        },

        tooltip: {
          callbacks: {
            label(context) {
              return `${
                context.dataset.label
              }: ${
                formatCurrency(
                  context.raw
                )
              }`;
            }
          }
        }
      },

      scales: {
        y: {
          beginAtZero: true,

          ticks: {
            callback(value) {
              return formatCurrency(value);
            }
          }
        }
      }
    }
  });

  dashboardCharts.push(chart);
}

function renderSiteProfitChart(sites) {
  const canvas =
    document.getElementById(
      "siteProfitChart"
    );

  if (
    !canvas ||
    typeof Chart === "undefined" ||
    sites.length === 0
  ) {
    return;
  }

  const chartColors = [
    "rgba(37, 99, 235, 0.8)",
    "rgba(34, 197, 94, 0.8)",
    "rgba(245, 158, 11, 0.8)",
    "rgba(168, 85, 247, 0.8)",
    "rgba(239, 68, 68, 0.8)",
    "rgba(14, 165, 233, 0.8)",
    "rgba(236, 72, 153, 0.8)",
    "rgba(100, 116, 139, 0.8)"
  ];

  const chart = new Chart(canvas, {
    type: "bar",

    data: {
      labels:
        sites.map(site =>
          site.name
        ),

      datasets: [
        {
          label: "רווח",

          data:
            sites.map(site =>
              site.profit
            ),

          backgroundColor:
            sites.map((site, index) => {
              if (site.profit < 0) {
                return "rgba(239, 68, 68, 0.8)";
              }

              return chartColors[
                index % chartColors.length
              ];
            }),

          borderWidth: 1
        }
      ]
    },

    options: {
      responsive: true,
      maintainAspectRatio: false,

      plugins: {
        legend: {
          display: false
        },

        tooltip: {
          callbacks: {
            label(context) {
              return `רווח: ${formatCurrency(
                context.raw
              )}`;
            }
          }
        }
      },

      scales: {
        x: {
          ticks: {
            font: {
              size: 14
            }
          }
        },

        y: {
          beginAtZero: true,

          ticks: {
            callback(value) {
              return formatCurrency(value);
            }
          }
        }
      }
    }
  });

  dashboardCharts.push(chart);
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

/* =========================================
   תעריפים
========================================= */

function renderRatesPage() {
  pageTitle.innerText = "תעריפים";

  if (!Array.isArray(appData.rates)) {
    appData.rates = [];
  }

  const sortedRates = [...appData.rates].sort((a, b) => {
    const siteA =
      getName(appData.sites, a.siteId);

    const siteB =
      getName(appData.sites, b.siteId);

    const siteCompare =
      siteA.localeCompare(siteB, "he");

    if (siteCompare !== 0) {
      return siteCompare;
    }

    return String(a.effectiveFrom || "")
      .localeCompare(
        String(b.effectiveFrom || "")
      );
  });

  content.innerHTML = `
    <div class="card">
      <h3>הוספת תעריף</h3>

      <label>בחר אתרי עבודה</label>

      <div
        id="rateSitesBox"
        class="checkbox-list"
      >
        ${
          appData.sites.length === 0
            ? `
              <p class="empty-message">
                אין אתרי עבודה
              </p>
            `
            : appData.sites.map(site => `
                <label class="checkbox-item">
                  <input
                    type="checkbox"
                    name="rateSites"
                    value="${site.id}"
                  />

                  <span>
                    ${site.name}
                  </span>
                </label>
              `).join("")
        }
      </div>

      <div class="employee-actions">
        <button
          type="button"
          class="secondary-btn"
          onclick="selectAllRateSites()"
        >
          בחר את כל האתרים
        </button>

        <button
          type="button"
          class="secondary-btn"
          onclick="clearAllRateSites()"
        >
          נקה את כל האתרים
        </button>
      </div>

      <label>סוג תעריף</label>

      <select
        id="rateType"
        onchange="updateRateTargetOptions()"
      >
        <option value="subcontractor">
          קבלן משנה
        </option>

        <option value="employee">
          עובד ספציפי
        </option>
      </select>

      <label id="rateTargetLabel">
        בחר קבלני משנה
      </label>

      <div
        id="rateTargetsBox"
        class="checkbox-list"
      ></div>

      <div class="employee-actions">
        <button
          type="button"
          class="secondary-btn"
          onclick="selectAllRateTargets()"
        >
          בחר הכל
        </button>

        <button
          type="button"
          class="secondary-btn"
          onclick="clearAllRateTargets()"
        >
          נקה הכל
        </button>
      </div>

      <label>הכנסה לעובד ליום</label>

      <input
        id="rateRevenue"
        type="number"
        min="0"
        step="0.01"
        inputmode="decimal"
        placeholder="כמה אתה מקבל עבור העובד"
      />

      <label>עלות לעובד ליום</label>

      <input
        id="rateCost"
        type="number"
        min="0"
        step="0.01"
        inputmode="decimal"
        placeholder="כמה העובד או הקבלן עולה לך"
      />

      <label>תאריך תחילת התעריף</label>

      <input
        id="rateEffectiveFrom"
        type="date"
      />

      <button
        class="primary-btn"
        type="button"
        onclick="addRate()"
      >
        הוסף תעריפים
      </button>
    </div>

    <div
      class="card"
      style="margin-top:20px;"
    >
      <h3>
        תעריפים קיימים -
        סה״כ ${appData.rates.length}
      </h3>

      ${
        sortedRates.length === 0
          ? `
            <p>
              עדיין לא הוגדרו תעריפים.
            </p>
          `
          : `
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>אתר</th>
                  <th>סוג</th>
                  <th>עובד / קבלן</th>
                  <th>שיוך</th>
                  <th>הכנסה</th>
                  <th>עלות</th>
                  <th>רווח</th>
                  <th>בתוקף מתאריך</th>
                  <th>פעולות</th>
                </tr>
              </thead>

              <tbody>
                ${sortedRates.map((rate, index) => {
                  const revenue =
                    Number(rate.revenuePerWorker) || 0;

                  const cost =
                    Number(rate.costPerWorker) || 0;

                  const profit =
                    revenue - cost;

                  const isEmployeeRate =
                    rate.rateType === "employee";

                  const employee =
                    isEmployeeRate
                      ? appData.employees.find(item =>
                          String(item.id) ===
                          String(rate.employeeId)
                        )
                      : null;

                  const targetName =
                    isEmployeeRate
                      ? employee?.name || ""
                      : getName(
                          appData.subcontractors,
                          rate.subcontractorId
                        );

                  const affiliationName =
                    isEmployeeRate && employee
                      ? getEmployeeAffiliationName(employee)
                      : "קבלן משנה";

                  return `
                    <tr>
                      <td>
                        ${index + 1}
                      </td>

                      <td>
                        ${
                          getName(
                            appData.sites,
                            rate.siteId
                          ) || "אתר לא נמצא"
                        }
                      </td>

                      <td>
                        ${
                          isEmployeeRate
                            ? "תעריף אישי"
                            : "תעריף כללי"
                        }
                      </td>

                      <td>
                        ${
                          targetName ||
                          "לא נמצא"
                        }
                      </td>

                      <td>
                        ${affiliationName}
                      </td>

                      <td>
                        ${formatCurrency(revenue)}
                      </td>

                      <td>
                        ${formatCurrency(cost)}
                      </td>

                      <td>
                        ${formatCurrency(profit)}
                      </td>

                      <td dir="ltr">
                        ${
                          normalizeDate(
                            rate.effectiveFrom
                          )
                        }
                      </td>

                      <td>
                        <button
                          type="button"
                          onclick="deleteRate('${rate.id}')"
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

  updateRateTargetOptions();

  const dateInput =
    document.getElementById(
      "rateEffectiveFrom"
    );

  if (dateInput) {
    dateInput.value =
      new Date()
        .toISOString()
        .split("T")[0];
  }
}

function selectAllRateSites() {
  document
    .querySelectorAll(
      'input[name="rateSites"]'
    )
    .forEach(input => {
      input.checked = true;
    });
}

function clearAllRateSites() {
  document
    .querySelectorAll(
      'input[name="rateSites"]'
    )
    .forEach(input => {
      input.checked = false;
    });
}

function selectAllRateTargets() {
  document
    .querySelectorAll(
      'input[name="rateTargets"]'
    )
    .forEach(input => {
      input.checked = true;
    });
}

function clearAllRateTargets() {
  document
    .querySelectorAll(
      'input[name="rateTargets"]'
    )
    .forEach(input => {
      input.checked = false;
    });
}

function updateRateTargetOptions() {
  const rateType =
    document.getElementById("rateType")?.value || "";

  const targetLabel =
    document.getElementById("rateTargetLabel");

  const targetsBox =
    document.getElementById("rateTargetsBox");

  if (!targetLabel || !targetsBox) {
    return;
  }

  if (rateType === "employee") {
    targetLabel.innerText =
      "בחר עובדים ספציפיים";

    targetsBox.innerHTML =
      appData.employees.length === 0
        ? `
          <p class="empty-message">
            אין עובדים
          </p>
        `
        : appData.employees.map(employee => `
            <label class="checkbox-item">
              <input
                type="checkbox"
                name="rateTargets"
                value="${employee.id}"
              />

              <span>
                ${employee.name}
                — ${getEmployeeAffiliationName(employee)}
              </span>
            </label>
          `).join("");

    return;
  }

  targetLabel.innerText =
    "בחר קבלני משנה";

  targetsBox.innerHTML =
    appData.subcontractors.length === 0
      ? `
        <p class="empty-message">
          אין קבלני משנה
        </p>
      `
      : appData.subcontractors.map(subcontractor => `
          <label class="checkbox-item">
            <input
              type="checkbox"
              name="rateTargets"
              value="${subcontractor.id}"
            />

            <span>
              ${subcontractor.name}
            </span>
          </label>
        `).join("");
}

function addRate() {
  const selectedSiteIds =
    Array.from(
      document.querySelectorAll(
        'input[name="rateSites"]:checked'
      )
    ).map(input => input.value);

  const rateType =
    document.getElementById("rateType")?.value || "";

  const selectedTargetIds =
    Array.from(
      document.querySelectorAll(
        'input[name="rateTargets"]:checked'
      )
    ).map(input => input.value);

  const revenueValue =
    document.getElementById("rateRevenue")?.value || "";

  const costValue =
    document.getElementById("rateCost")?.value || "";

  const effectiveFrom =
    document.getElementById(
      "rateEffectiveFrom"
    )?.value || "";

  const revenuePerWorker =
    Number(revenueValue);

  const costPerWorker =
    Number(costValue);

  if (selectedSiteIds.length === 0) {
    alert("נא לבחור לפחות אתר עבודה אחד");
    return;
  }

  if (
    rateType !== "employee" &&
    rateType !== "subcontractor"
  ) {
    alert("נא לבחור סוג תעריף");
    return;
  }

  if (selectedTargetIds.length === 0) {
    alert(
      rateType === "employee"
        ? "נא לבחור לפחות עובד אחד"
        : "נא לבחור לפחות קבלן משנה אחד"
    );

    return;
  }

  if (
    revenueValue === "" ||
    !Number.isFinite(revenuePerWorker) ||
    revenuePerWorker < 0
  ) {
    alert("נא להזין הכנסה תקינה");
    return;
  }

  if (
    costValue === "" ||
    !Number.isFinite(costPerWorker) ||
    costPerWorker < 0
  ) {
    alert("נא להזין עלות תקינה");
    return;
  }

  if (!effectiveFrom) {
    alert("נא לבחור תאריך תחילת תעריף");
    return;
  }

  if (!Array.isArray(appData.rates)) {
    appData.rates = [];
  }

  let addedCount = 0;
  let skippedCount = 0;

  selectedSiteIds.forEach(siteId => {
    selectedTargetIds.forEach(targetId => {
      const duplicateRate =
        appData.rates.some(rate => {
          const sameBaseData =
            String(rate.siteId) === String(siteId) &&
            String(rate.rateType) === String(rateType) &&
            normalizeDate(rate.effectiveFrom) ===
              effectiveFrom;

          if (!sameBaseData) {
            return false;
          }

          if (rateType === "employee") {
            return (
              String(rate.employeeId || "") ===
              String(targetId)
            );
          }

          return (
            String(rate.subcontractorId || "") ===
            String(targetId)
          );
        });

      if (duplicateRate) {
        skippedCount += 1;
        return;
      }

      appData.rates.push({
        id: generateId(),

        siteId,
        rateType,

        subcontractorId:
          rateType === "subcontractor"
            ? targetId
            : "",

        employeeId:
          rateType === "employee"
            ? targetId
            : "",

        revenuePerWorker,
        costPerWorker,
        effectiveFrom
      });

      addedCount += 1;
    });
  });

  if (addedCount === 0) {
    alert(
      "לא נוספו תעריפים. כל השילובים שנבחרו כבר קיימים."
    );
    return;
  }

  saveData();
  renderRatesPage();

  if (skippedCount > 0) {
    alert(
      `נוספו ${addedCount} תעריפים. ${skippedCount} שילובים כבר היו קיימים ולא נוספו שוב.`
    );
  } else {
    alert(
      `נוספו בהצלחה ${addedCount} תעריפים.`
    );
  }
}

function deleteRate(id) {
  if (!Array.isArray(appData.rates)) {
    appData.rates = [];
  }

  const rate =
    appData.rates.find(item =>
      String(item.id) === String(id)
    );

  if (!rate) {
    alert("התעריף לא נמצא");
    return;
  }

  const siteName =
    getName(
      appData.sites,
      rate.siteId
    ) || "האתר";

  const targetName =
    rate.rateType === "employee"
      ? getName(
          appData.employees,
          rate.employeeId
        )
      : getName(
          appData.subcontractors,
          rate.subcontractorId
        );

  const confirmed = confirm(
    `האם למחוק את התעריף של ${
      targetName || "העובד או הקבלן"
    } באתר ${siteName}?`
  );

  if (!confirmed) {
    return;
  }

  appData.rates =
    appData.rates.filter(item =>
      String(item.id) !== String(id)
    );

  saveData();
  renderRatesPage();
}

function formatCurrency(value) {
  const number =
    Number(value) || 0;

  return new Intl.NumberFormat(
    "he-IL",
    {
      style: "currency",
      currency: "ILS",
      maximumFractionDigits: 2
    }
  ).format(number);
}

/* =========================================
   חישובי הכנסות, עלויות ורווח
========================================= */

function normalizeDate(value) {
  return String(value || "")
    .split("T")[0];
}

function getApplicableRate(
  employee,
  siteId,
  workDate
) {
  if (
    !employee ||
    !siteId ||
    !workDate
  ) {
    return null;
  }

  const normalizedWorkDate =
    normalizeDate(workDate);

  const rates =
    Array.isArray(appData.rates)
      ? appData.rates
      : [];

  const validRates = rates
    .filter(rate => {
      const rateDate =
        normalizeDate(rate.effectiveFrom);

      return (
        String(rate.siteId) === String(siteId) &&
        rateDate &&
        rateDate <= normalizedWorkDate
      );
    })
    .sort((a, b) => {
      return normalizeDate(b.effectiveFrom)
        .localeCompare(
          normalizeDate(a.effectiveFrom)
        );
    });

  // עדיפות ראשונה:
  // תעריף אישי לעובד
  const employeeRate =
    validRates.find(rate =>
      rate.rateType === "employee" &&
      String(rate.employeeId || "") ===
        String(employee.id)
    );

  if (employeeRate) {
    return employeeRate;
  }

  // עובד פנימי חייב תעריף אישי
  if (employee.type === "internal") {
    return null;
  }

  // עדיפות שנייה:
  // תעריף כללי של קבלן המשנה
  const subcontractorRate =
    validRates.find(rate =>
      rate.rateType === "subcontractor" &&
      String(rate.subcontractorId || "") ===
        String(employee.subcontractorId || "")
    );

  return subcontractorRate || null;
}

function calculateWorkLogFinance(log) {
  const result = {
    revenue: 0,
    cost: 0,
    profit: 0,

    employeeDays: 0,

    calculatedEmployees: [],
    missingRateEmployees: []
  };

  if (!log) {
    return result;
  }

  const employeeIds =
    getEmployeeIds(log);

  employeeIds.forEach(employeeId => {
    const employee =
      appData.employees.find(item =>
        String(item.id) ===
        String(employeeId)
      );

    if (!employee) {
      return;
    }

    const rate =
      getApplicableRate(
        employee,
        log.siteId,
        log.date
      );

    if (!rate) {
      result.missingRateEmployees.push({
        employeeId: employee.id,
        employeeName: employee.name
      });

      return;
    }

    const revenue =
      Number(
        rate.revenuePerWorker
      ) || 0;

    const cost =
      Number(
        rate.costPerWorker
      ) || 0;

    const profit =
      revenue - cost;

    result.revenue += revenue;
    result.cost += cost;
    result.profit += profit;
    result.employeeDays += 1;

    result.calculatedEmployees.push({
      employeeId: employee.id,
      employeeName: employee.name,
      rateId: rate.id,
      revenue,
      cost,
      profit
    });
  });

  return result;
}

function calculateFinanceForPeriod(
  fromDate = "",
  toDate = ""
) {
  const result = {
    revenue: 0,
    cost: 0,
    profit: 0,

    workLogs: 0,
    employeeDays: 0,

    missingRates: []
  };

  const logs =
    Array.isArray(appData.workLogs)
      ? appData.workLogs
      : [];

  logs.forEach(log => {
    const logDate =
      normalizeDate(log.date);

    const matchesFrom =
      !fromDate ||
      logDate >= fromDate;

    const matchesTo =
      !toDate ||
      logDate <= toDate;

    if (!matchesFrom || !matchesTo) {
      return;
    }

    const finance =
      calculateWorkLogFinance(log);

    result.revenue +=
      finance.revenue;

    result.cost +=
      finance.cost;

    result.profit +=
      finance.profit;

    result.workLogs += 1;

    result.employeeDays +=
      finance.employeeDays;

    finance.missingRateEmployees.forEach(
      employee => {
        result.missingRates.push({
          date: logDate,

          siteId:
            log.siteId,

          siteName:
            getName(
              appData.sites,
              log.siteId
            ),

          employeeId:
            employee.employeeId,

          employeeName:
            employee.employeeName
        });
      }
    );
  });

  return result;
}

function getCurrentMonthRange() {
  const now = new Date();

  const year =
    now.getFullYear();

  const month =
    String(
      now.getMonth() + 1
    ).padStart(2, "0");

  const lastDay =
    new Date(
      year,
      now.getMonth() + 1,
      0
    ).getDate();

  return {
    from:
      `${year}-${month}-01`,

    to:
      `${year}-${month}-${String(
        lastDay
      ).padStart(2, "0")}`
  };
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

async function exportToExcel() {
  if (
    typeof ExcelJS === "undefined" ||
    typeof saveAs === "undefined"
  ) {
    alert("ספריית Excel לא נטענה. רענן את הדף ונסה שוב.");
    return;
  }

  const filteredLogs =
    filterReportLogs();

  if (filteredLogs.length === 0) {
    alert("אין נתונים לייצוא");
    return;
  }

  try {
    const workbook =
      new ExcelJS.Workbook();

    workbook.creator = "יומן עבודה";
    workbook.created = new Date();

    const worksheet =
      workbook.addWorksheet(
        "יומן עבודה",
        {
          views: [
            {
              rightToLeft: true,
              state: "frozen",
              ySplit: 1
            }
          ]
        }
      );

    worksheet.columns = [
      {
        header: "תאריך",
        key: "date",
        width: 15
      },
      {
        header: "עובדים",
        key: "employees",
        width: 38
      },
      {
        header: "שיוך / קבלן משנה",
        key: "affiliation",
        width: 28
      },
      {
        header: "סה״כ עובדים",
        key: "employeeCount",
        width: 15
      },
      {
        header: "אתר עבודה",
        key: "site",
        width: 22
      },
      {
        header: "מבנים",
        key: "buildings",
        width: 30
      },
      {
        header: "מזמין עבודה",
        key: "customer",
        width: 24
      },
      {
        header: "הערות",
        key: "notes",
        width: 40
      }
    ];

    filteredLogs.forEach(log => {
      const reportEmployees =
        getReportEmployees(log);

      worksheet.addRow({
        date:
          normalizeDate(log.date),

        employees:
          reportEmployees
            .map(employee => employee.name)
            .join(", "),

        affiliation:
          getReportAffiliationNames(log),

        employeeCount:
          reportEmployees.length,

        site:
          getName(
            appData.sites,
            log.siteId
          ),

        buildings:
          getBuildingNames(log),

        customer:
          getName(
            appData.customers,
            log.customerId
          ),

        notes:
          log.notes || ""
      });
    });

    const headerRow =
      worksheet.getRow(1);

    headerRow.height = 30;

    headerRow.eachCell(cell => {
      cell.font = {
        bold: true,
        color: {
          argb: "FFFFFFFF"
        },
        size: 12
      };

      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb: "FF2563EB"
        }
      };

      cell.alignment = {
        horizontal: "center",
        vertical: "middle"
      };

      cell.border = {
        top: {
          style: "thin",
          color: { argb: "FFD1D5DB" }
        },
        bottom: {
          style: "thin",
          color: { argb: "FFD1D5DB" }
        },
        left: {
          style: "thin",
          color: { argb: "FFD1D5DB" }
        },
        right: {
          style: "thin",
          color: { argb: "FFD1D5DB" }
        }
      };
    });

    worksheet.eachRow(
      { includeEmpty: false },
      (row, rowNumber) => {
        if (rowNumber === 1) {
          return;
        }

        row.height = 25;

        row.eachCell(cell => {
          cell.alignment = {
            horizontal: "right",
            vertical: "middle",
            wrapText: true
          };

          cell.border = {
            top: {
              style: "thin",
              color: { argb: "FFE5E7EB" }
            },
            bottom: {
              style: "thin",
              color: { argb: "FFE5E7EB" }
            },
            left: {
              style: "thin",
              color: { argb: "FFE5E7EB" }
            },
            right: {
              style: "thin",
              color: { argb: "FFE5E7EB" }
            }
          };

          if (rowNumber % 2 === 0) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: {
                argb: "FFF3F4F6"
              }
            };
          }
        });

        row.getCell("D").alignment = {
          horizontal: "center",
          vertical: "middle"
        };
      }
    );

    worksheet.autoFilter = {
      from: "A1",
      to: "H1"
    };

    worksheet.getColumn("A").numFmt =
      "dd/mm/yyyy";

    const buffer =
      await workbook.xlsx.writeBuffer();

    const today =
      new Date()
        .toISOString()
        .split("T")[0];

    const file =
      new Blob(
        [buffer],
        {
          type:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        }
      );

    saveAs(
      file,
      `יומן_עבודה_${today}.xlsx`
    );
  } catch (error) {
    console.error(
      "שגיאה ביצירת קובץ Excel:",
      error
    );

    alert(
      "הפקת קובץ Excel נכשלה."
    );
  }
}

