const SESSION_KEY = "nextact_current_user";
const THEME_KEY = "nextact_theme";

const allCasesList = document.getElementById("allCasesList");
const goDashboardBtn = document.getElementById("goDashboardBtn");
const loggedInUserName = document.getElementById("loggedInUserName");
const toggleDarkModeBtn = document.getElementById("toggleDarkModeBtn");
const logoutBtn = document.getElementById("logoutBtn");

function requireSession() {
  const sessionRaw = localStorage.getItem(SESSION_KEY);
  if (!sessionRaw) window.location.href = "login.html";
}

function applyTheme(theme) {
  document.body.classList.toggle("dark-mode", theme === "dark");
  toggleDarkModeBtn.textContent = theme === "dark" ? "☀" : "◐";
}

function readTheme() {
  return localStorage.getItem(THEME_KEY) || "light";
}

function renderLoggedInUser() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return;
    const session = JSON.parse(raw);
    loggedInUserName.textContent = session.name ? `Hello, ${session.name}` : "";
  } catch (error) {
    loggedInUserName.textContent = "";
  }
}

async function renderCases() {
  allCasesList.innerHTML = "<li><div><strong>Loading cases...</strong></div></li>";

  try {
    const cases = await getCases();

    allCasesList.innerHTML = "";

    if (!cases.length) {
      const li = document.createElement("li");
      li.innerHTML = `
        <div>
          <strong>No cases yet.</strong>
          <p class="meta">Create a case from the dashboard to see it here.</p>
        </div>
      `;
      allCasesList.appendChild(li);
      return;
    }

    cases.forEach((entry) => {
      const badgeClass =
        String(entry.status || "").toLowerCase() === "finished" ? "badge success" : "badge";

      const li = document.createElement("li");
      li.dataset.caseId = entry.id;
      li.classList.add("case-row-clickable");
      li.innerHTML = `
        <div>
          <strong>${entry.name}</strong>
          <p class="meta">
            ${entry.short_description || "No description"} • ${entry.client_name || "No client"}
          </p>
          <p class="case-doc-status">
            Deadline: ${entry.deadline || "Not set"}          </p>
        </div>
        <div class="case-actions">
          <span class="${badgeClass}">${entry.status || "open"}</span>
        </div>
      `;
      allCasesList.appendChild(li);
    });
  } catch (error) {
    allCasesList.innerHTML = `
      <li>
        <div>
          <strong>Failed to load cases.</strong>
          <p class="meta">${error.message}</p>
        </div>
      </li>
    `;
  }
}

allCasesList.addEventListener("click", (event) => {
  const row = event.target.closest("[data-case-id]");
  if (row) {
    window.location.href = `case-detail.html?id=${encodeURIComponent(row.dataset.caseId)}`;
  }
});

goDashboardBtn.addEventListener("click", () => {
  window.location.href = "index.html";
});

toggleDarkModeBtn.addEventListener("click", () => {
  const nextTheme = document.body.classList.contains("dark-mode") ? "light" : "dark";
  localStorage.setItem(THEME_KEY, nextTheme);
  applyTheme(nextTheme);
});

logoutBtn.addEventListener("click", () => {
  if (!window.confirm("Are you sure you want to log out?")) return;
  localStorage.removeItem(SESSION_KEY);
  window.location.href = "login.html";
});

requireSession();
applyTheme(readTheme());
renderLoggedInUser();
renderCases();