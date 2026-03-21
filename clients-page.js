const SESSION_KEY = "nextact_current_user";
const CLIENTS_KEY = "nextact_clients";
const CASES_KEY = "nextact_cases";
const THEME_KEY = "nextact_theme";

const clientsList = document.getElementById("clientsList");
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

function renderClients() {
  const clients = readClients();
  const cases = readCases();
  clientsList.innerHTML = "";

  if (!clients.length) {
    clientsList.innerHTML = `
      <li>
        <div>
          <strong>No clients yet.</strong>
          <p class="meta">Add a client from the case form.</p>
        </div>
      </li>
    `;
    return;
  }

  clients.forEach((client) => {
    const caseCount = cases.filter((entry) =>
      (entry.clientNames || []).some((name) => normalizeName(name) === normalizeName(client.name))
    ).length;

    const li = document.createElement("li");
    li.dataset.clientName = client.name;
    li.classList.add("case-row-clickable");
    li.innerHTML = `
      <div>
        <strong>${client.name}</strong>
        <p class="meta">${client.address || "No address"} • ${client.email || "No email"} • ${client.phone || "No phone"}</p>
      </div>
      <span class="badge">${caseCount} case(s)</span>
    `;
    clientsList.appendChild(li);
  });
}

clientsList.addEventListener("click", (event) => {
  const row = event.target.closest("[data-client-name]");
  if (!row) return;
  window.location.href = `client-detail.html?name=${encodeURIComponent(row.dataset.clientName)}`;
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
renderClients();
