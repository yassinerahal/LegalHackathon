const SESSION_KEY = "nextact_current_user";
const THEME_KEY = "nextact_theme";

const clientsList = document.getElementById("clientsList");
const goDashboardBtn = document.getElementById("goDashboardBtn");
const loggedInUserName = document.getElementById("loggedInUserName");
const toggleDarkModeBtn = document.getElementById("toggleDarkModeBtn");
const billingBtn = document.getElementById("billingBtn");
const logoutBtn = document.getElementById("logoutBtn");

function requireSession() {
  return requireStaffSession();
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
  clientsList.innerHTML =
    '<li class="rounded-[22px] border border-dashed border-slate-200 bg-slate-50/80 px-5 py-6 text-sm text-slate-500"><div><strong>Loading clients...</strong></div></li>';

  try {
    const [clients, cases] = await Promise.all([getClients(), getCases()]);

    clientsList.innerHTML = "";

    if (!clients.length) {
      clientsList.innerHTML = `
        <li class="rounded-[22px] border border-dashed border-slate-200 bg-slate-50/80 px-5 py-6 text-sm text-slate-500">
          <div>
            <strong>No clients yet.</strong>
            <p class="mt-2">Add a client from the case form.</p>
          </div>
        </li>
      `;
      return;
    }

    clients.forEach((client) => {
      const caseCount = cases.filter((entry) => Number(entry.client_id) === Number(client.id)).length;

      const li = document.createElement("li");
      li.dataset.clientId = client.id;
      li.className =
        "case-row-clickable grid gap-4 rounded-[22px] border border-slate-200 bg-white px-5 py-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg";
      li.innerHTML = `
        <div class="min-w-0">
          <strong class="block text-lg font-semibold text-slate-800">${client.full_name}</strong>
          <p class="mt-2 text-sm text-slate-500">
            ${client.address || "No address"} • ${client.email || "No email"} • ${client.phone || "No phone"}
          </p>
        </div>
        <div class="case-actions flex flex-wrap items-center justify-end gap-3">
          <button type="button" class="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50" data-related-cases="${client.id}">
            View Related Cases
          </button>
          <span class="rounded-full bg-indigo-50 px-4 py-2 text-xs font-semibold text-indigo-600">${caseCount} case(s)</span>
        </div>
      `;
      clientsList.appendChild(li);
    });
  } catch (error) {
    clientsList.innerHTML = `
      <li class="rounded-[22px] border border-dashed border-rose-200 bg-rose-50/70 px-5 py-6 text-sm text-rose-600">
        <div>
          <strong>Failed to load clients.</strong>
          <p class="mt-2">${error.message}</p>
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

if (billingBtn) {
  billingBtn.addEventListener("click", () => {
    window.location.href = "billing.html";
  });
}

toggleDarkModeBtn.addEventListener("click", () => {
  const nextTheme = document.body.classList.contains("dark-mode") ? "light" : "dark";
  localStorage.setItem(THEME_KEY, nextTheme);
  applyTheme(nextTheme);
});

logoutBtn.addEventListener("click", () => {
  if (!window.confirm("Are you sure you want to log out?")) return;
  clearStoredSession();
  window.location.href = "login.html";
});

requireSession();
applyTheme(readTheme());
renderLoggedInUser();
renderClients();
