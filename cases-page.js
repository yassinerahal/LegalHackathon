const SESSION_KEY = "nextact_current_user";
const CASES_KEY = "nextact_cases";
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

function renderCases() {
  const cases = readCases();
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
    const comments = (entry.comments || []).slice(0, 1);
    const requiredDocs = entry.requiredDocuments || [];
    const pendingCount = requiredDocs.filter((doc) => doc.status === "Pending").length;
    const uploadedCount = (entry.uploadedDocuments || []).length;
    const badgeClass = entry.status === "Finished" ? "badge success" : "badge";
    const li = document.createElement("li");
    li.dataset.caseId = entry.id;
    li.classList.add("case-row-clickable");
    li.innerHTML = `
      <div>
        <strong>${entry.title}</strong>
        <p class="meta">${entry.stage} • ${(entry.clientNames || []).join(", ")}</p>
        <p class="case-doc-status">Required docs: ${requiredDocs.length} • Pending: ${pendingCount} • Uploaded files: ${uploadedCount}</p>
        ${
          comments.length
            ? `<p class="case-comment">${comments[0].createdAtLabel}: ${comments[0].text}</p>`
            : '<p class="case-comment">No comments yet.</p>'
        }
      </div>
      <div class="case-actions">
        <span class="${badgeClass}">${entry.status || "Active"}</span>
      </div>
    `;
    allCasesList.appendChild(li);
  });
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
  localStorage.removeItem(SESSION_KEY);
  window.location.href = "login.html";
});

requireSession();
applyTheme(readTheme());
renderLoggedInUser();
renderCases();
