const SESSION_KEY = "nextact_current_user";
const CLIENTS_KEY = "nextact_clients";
const CASES_KEY = "nextact_cases";
const THEME_KEY = "nextact_theme";

const clientTitle = document.getElementById("clientTitle");
const clientInfo = document.getElementById("clientInfo");
const relatedCasesList = document.getElementById("relatedCasesList");
const goDashboardBtn = document.getElementById("goDashboardBtn");
const loggedInUserName = document.getElementById("loggedInUserName");
const toggleDarkModeBtn = document.getElementById("toggleDarkModeBtn");
const logoutBtn = document.getElementById("logoutBtn");

function requireSession() {
  if (!localStorage.getItem(SESSION_KEY)) window.location.href = "login.html";
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

function readClients() {
  const raw = localStorage.getItem(CLIENTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function readCases() {
  const raw = localStorage.getItem(CASES_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function normalizeName(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function getClientNameFromQuery() {
  const params = new URLSearchParams(window.location.search);
  return params.get("name");
}

function renderClientPage(client, relatedCases) {
  clientTitle.textContent = client.name;
  clientInfo.textContent = `${client.address || "No address"} • ${client.email || "No email"} • ${client.phone || "No phone"}`;
  relatedCasesList.innerHTML = "";

  if (!relatedCases.length) {
    relatedCasesList.innerHTML = `
      <li>
        <div>
          <strong>No related cases yet.</strong>
          <p class="meta">This client is not assigned to any case.</p>
        </div>
      </li>
    `;
    return;
  }

  relatedCases.forEach((entry) => {
    const li = document.createElement("li");
    li.dataset.caseId = entry.id;
    li.classList.add("case-row-clickable");
    const badgeClass = entry.status === "Finished" ? "badge success" : "badge";
    li.innerHTML = `
      <div>
        <strong>${entry.title}</strong>
        <p class="meta">${entry.stage || "No description"} • Deadline: ${entry.deadline || "Not set"}</p>
      </div>
      <span class="${badgeClass}">${entry.status || "Active"}</span>
    `;
    relatedCasesList.appendChild(li);
  });
}

relatedCasesList.addEventListener("click", (event) => {
  const row = event.target.closest("[data-case-id]");
  if (!row) return;
  window.location.href = `case-detail.html?id=${encodeURIComponent(row.dataset.caseId)}`;
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
  localStorage.removeItem(SESSION_KEY);
  window.location.href = "login.html";
});

requireSession();
applyTheme(readTheme());
renderLoggedInUser();
const queryName = getClientNameFromQuery();
const clients = readClients();
const cases = readCases();
const client = clients.find((entry) => normalizeName(entry.name) === normalizeName(queryName));
if (!client) {
  window.location.href = "clients.html";
} else {
  const relatedCases = cases.filter((entry) =>
    (entry.clientNames || []).some((name) => normalizeName(name) === normalizeName(client.name))
  );
  renderClientPage(client, relatedCases);
}
