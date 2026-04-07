const SESSION_KEY = "nextact_current_user";
const THEME_KEY = "nextact_theme";

const allCasesList = document.getElementById("allCasesList");
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

async function renderCases() {
  allCasesList.innerHTML =
    '<li class="rounded-[22px] border border-dashed border-slate-200 bg-slate-50/80 px-5 py-6 text-sm text-slate-500"><div><strong>Loading cases...</strong></div></li>';

  try {
    const cases = await getCases();

    allCasesList.innerHTML = "";

    if (!cases.length) {
      const li = document.createElement("li");
      li.className = "rounded-[22px] border border-dashed border-slate-200 bg-slate-50/80 px-5 py-6 text-sm text-slate-500";
      li.innerHTML = `
        <div>
          <strong>No cases yet.</strong>
          <p class="mt-2">Create a case from the dashboard to see it here.</p>
        </div>
      `;
      allCasesList.appendChild(li);
      return;
    }

    cases.forEach((entry) => {
      const isFinished = String(entry.status || "").toLowerCase() === "finished";
      const li = document.createElement("li");
      li.dataset.caseId = entry.id;
      li.className =
        "case-row-clickable grid gap-4 rounded-[22px] border border-slate-200 bg-white px-5 py-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg";
      li.innerHTML = `
        <div class="min-w-0">
          <strong class="block text-lg font-semibold text-slate-800">${entry.name}</strong>
          <p class="mt-2 text-sm text-slate-500">
            ${entry.short_description || "No description"} • ${entry.client_name || "No client"}
          </p>
          <p class="mt-4 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
            Deadline: ${entry.deadline || "Not set"}
          </p>
        </div>
        <div class="case-actions flex items-start justify-end">
          <span class="rounded-full px-4 py-2 text-xs font-semibold ${isFinished ? "bg-emerald-50 text-emerald-600" : "bg-indigo-50 text-indigo-600"}">
            ${entry.status || "open"}
          </span>
        </div>
      `;
      allCasesList.appendChild(li);
    });
  } catch (error) {
    allCasesList.innerHTML = `
      <li class="rounded-[22px] border border-dashed border-rose-200 bg-rose-50/70 px-5 py-6 text-sm text-rose-600">
        <div>
          <strong>Failed to load cases.</strong>
          <p class="mt-2">${error.message}</p>
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
renderCases();
