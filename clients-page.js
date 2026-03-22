const SESSION_KEY = "nextact_current_user";
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

async function renderClients() {
  clientsList.innerHTML = "<li><div><strong>Loading clients...</strong></div></li>";

  try {
    const [clients, cases] = await Promise.all([getClients(), getCases()]);

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
      const caseCount = cases.filter((entry) => Number(entry.client_id) === Number(client.id)).length;

      const li = document.createElement("li");
      li.dataset.clientId = client.id;
      li.classList.add("case-row-clickable");
      li.innerHTML = `
        <div>
          <strong>${client.full_name}</strong>
          <p class="meta">
            ${client.address || "No address"} • ${client.email || "No email"} • ${client.phone || "No phone"}
          </p>
        </div>
        <div class="case-actions">
          <button type="button" class="btn-ghost btn-small" data-related-cases="${client.id}">
            View Related Cases
          </button>
          <span class="badge">${caseCount} case(s)</span>
        </div>
      `;
      clientsList.appendChild(li);
    });
  } catch (error) {
    clientsList.innerHTML = `
      <li>
        <div>
          <strong>Failed to load clients.</strong>
          <p class="meta">${error.message}</p>
        </div>
      </li>
    `;
  }
}

clientsList.addEventListener("click", (event) => {
  const relatedCasesButton = event.target.closest("[data-related-cases]");
  if (relatedCasesButton) {
    event.stopPropagation();
    window.location.href = `client-detail.html?id=${encodeURIComponent(relatedCasesButton.dataset.relatedCases)}#related-cases`;
    return;
  }

  const row = event.target.closest("[data-client-id]");
  if (!row) return;
  window.location.href = `client-detail.html?id=${encodeURIComponent(row.dataset.clientId)}`;
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
renderClients();
