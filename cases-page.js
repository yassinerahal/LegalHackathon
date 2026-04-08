const SESSION_KEY = "nextact_current_user";
const THEME_KEY = "nextact_theme";

const allCasesList = document.getElementById("allCasesList");
const goDashboardBtn = document.getElementById("goDashboardBtn");
const loggedInUserName = document.getElementById("loggedInUserName");
const toggleDarkModeBtn = document.getElementById("toggleDarkModeBtn");
const billingBtn = document.getElementById("billingBtn");
const logoutBtn = document.getElementById("logoutBtn");
const casesSearchForm = document.getElementById("casesSearchForm");
const casesSearchInput = document.getElementById("casesSearchInput");

let casesState = [];
let casesSearchQuery = "";

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

function normalizeSearchValue(value) {
  return String(value || "").trim().toLowerCase();
}

function scoreSearchMatch(query, candidate) {
  const normalizedQuery = normalizeSearchValue(query);
  const normalizedCandidate = normalizeSearchValue(candidate);

  if (!normalizedQuery || !normalizedCandidate) return 0;
  if (normalizedCandidate === normalizedQuery) return 160;
  if (normalizedCandidate.startsWith(normalizedQuery)) return 120;

  const wordIndex = normalizedCandidate.indexOf(` ${normalizedQuery}`);
  if (wordIndex >= 0) return 100 - Math.min(wordIndex, 40);

  const includesIndex = normalizedCandidate.indexOf(normalizedQuery);
  if (includesIndex >= 0) return 85 - Math.min(includesIndex, 50);

  return normalizedQuery
    .split(/\s+/)
    .filter(Boolean)
    .reduce((score, part) => {
      const partIndex = normalizedCandidate.indexOf(part);
      if (partIndex >= 0) return score + 28 - Math.min(partIndex, 20);
      if (normalizedCandidate.includes(part.slice(0, Math.max(2, part.length - 1)))) return score + 8;
      return score;
    }, 0);
}

function getCaseSearchText(entry) {
  return [
    entry.case_number,
    entry.name,
    entry.client_name,
    entry.short_description,
    entry.deadline,
    entry.status
  ]
    .filter(Boolean)
    .join(" ");
}

function getFilteredCases() {
  const query = normalizeSearchValue(casesSearchQuery);
  if (!query) return casesState.slice();

  return casesState
    .map((entry) => ({
      entry,
      score: scoreSearchMatch(query, getCaseSearchText(entry))
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return String(left.entry.name || "").localeCompare(String(right.entry.name || ""));
    })
    .map((item) => item.entry);
}

function drawCasesList() {
  allCasesList.innerHTML = "";

  if (!casesState.length) {
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

  const cases = getFilteredCases();

  if (!cases.length) {
    allCasesList.innerHTML = `
      <li class="rounded-[22px] border border-dashed border-slate-200 bg-slate-50/80 px-5 py-6 text-sm text-slate-500">
        <div>
          <strong>No matching cases found.</strong>
          <p class="mt-2">Try a broader name, client, deadline, or case number search.</p>
        </div>
      </li>
    `;
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
        ${entry.case_number ? `<p class="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">${entry.case_number}</p>` : ""}
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
}

async function renderCases() {
  allCasesList.innerHTML =
    '<li class="rounded-[22px] border border-dashed border-slate-200 bg-slate-50/80 px-5 py-6 text-sm text-slate-500"><div><strong>Loading cases...</strong></div></li>';

  try {
    casesState = await getCases();
    drawCasesList();
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

if (casesSearchForm && casesSearchInput) {
  casesSearchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    casesSearchQuery = casesSearchInput.value || "";
    drawCasesList();
  });
}

requireSession();
applyTheme(readTheme());
renderLoggedInUser();
renderCases();
