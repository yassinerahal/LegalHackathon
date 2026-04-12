const SESSION_KEY = "nextact_current_user";
const THEME_KEY = "nextact_theme";

const usersList = document.getElementById("usersList");
const usersStatus = document.getElementById("usersStatus");
const goDashboardBtn = document.getElementById("goDashboardBtn");
const loggedInUserName = document.getElementById("loggedInUserName");
const toggleDarkModeBtn = document.getElementById("toggleDarkModeBtn");
const billingBtn = document.getElementById("billingBtn");
const logoutBtn = document.getElementById("logoutBtn");
const usersSearchForm = document.getElementById("usersSearchForm");
const usersSearchInput = document.getElementById("usersSearchInput");

let usersState = [];
let usersSearchQuery = "";

function requireAdminSession() {
  const session = requireStaffSession();
  if (!session) return null;

  if (session.role !== "admin") {
    window.location.href = "index.html";
    return null;
  }

  return session;
}

function applyTheme(theme) {
  document.body.classList.toggle("dark-mode", theme === "dark");
  if (toggleDarkModeBtn) {
    toggleDarkModeBtn.textContent = theme === "dark" ? "☀" : "◐";
    toggleDarkModeBtn.title = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  }
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
    updateNavbarAuthUi();
  } catch (error) {
    loggedInUserName.textContent = "";
    updateNavbarAuthUi();
  }
}

function getRoleOptions(selectedRole) {
  const roles = ["admin", "lawyer", "assistant", "client", "pending"];
  return roles
    .map(
      (role) => `
        <option value="${role}" ${role === selectedRole ? "selected" : ""}>
          ${role}
        </option>
      `
    )
    .join("");
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

function getUserSearchText(user) {
  return [
    user.username,
    user.email,
    user.role,
    user.is_approved ? "approved" : "pending"
  ]
    .filter(Boolean)
    .join(" ");
}

function getFilteredUsers() {
  const query = normalizeSearchValue(usersSearchQuery);
  if (!query) return usersState.slice();

  return usersState
    .map((user) => ({
      user,
      score: scoreSearchMatch(query, getUserSearchText(user))
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return String(left.user.username || left.user.email || "").localeCompare(
        String(right.user.username || right.user.email || "")
      );
    })
    .map((item) => item.user);
}

function renderUsers() {
  if (!usersList) return;

  usersList.innerHTML = "";

  if (!usersState.length) {
    usersList.innerHTML = `
      <li class="rounded-[22px] border border-dashed border-slate-200 bg-slate-50/80 px-5 py-6 text-sm text-slate-500">
        <div>
          <strong>No users found.</strong>
          <p class="mt-2">Registered users will appear here automatically.</p>
        </div>
      </li>
    `;
    if (usersStatus) {
      usersStatus.textContent = "0 users loaded.";
    }
    return;
  }

  const filteredUsers = getFilteredUsers();
  const pendingCount = usersState.filter((user) => !user.is_approved || user.role === "pending").length;

  if (usersStatus) {
    const prefix = usersSearchQuery.trim()
      ? `${filteredUsers.length} matching user(s). `
      : `${usersState.length} users loaded. `;
    usersStatus.textContent = `${prefix}${pendingCount} waiting for approval.`;
  }

  if (!filteredUsers.length) {
    usersList.innerHTML = `
      <li class="rounded-[22px] border border-dashed border-slate-200 bg-slate-50/80 px-5 py-6 text-sm text-slate-500">
        <div>
          <strong>No matching users found.</strong>
          <p class="mt-2">Try a broader username, email, or role search.</p>
        </div>
      </li>
    `;
    return;
  }

  filteredUsers.forEach((user) => {
    const isPending = !user.is_approved || user.role === "pending";
    
    // Get current logged-in user ID for self-role modification lockout
    let currentUserId = null;
    try {
      const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "{}");
      currentUserId = session.id;
    } catch (error) {
      // Silently fail - currentUserId stays null
    }
    
    const isSelf = currentUserId && String(currentUserId) === String(user.id);
    
    const li = document.createElement("li");
    li.dataset.userId = user.id;
    li.className =
      "rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg";
    li.innerHTML = `
      <div class="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(180px,220px)_auto] lg:items-center">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-3">
            <strong class="text-lg font-semibold text-slate-800">${user.username || user.email}</strong>
            <span class="rounded-full px-3 py-1 text-xs font-semibold ${
              isPending ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
            }">
              ${isPending ? "Pending approval" : "Approved"}
            </span>
          </div>
          <p class="mt-2 text-sm text-slate-500">${user.email}</p>
          <p class="mt-3 text-xs uppercase tracking-[0.2em] text-slate-400">
            Current role: ${user.role || "pending"}
          </p>
        </div>
        <div>
          <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Role
          </label>
          <select
            data-user-role
            class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100 ${
              isSelf ? "cursor-not-allowed opacity-75 bg-gray-100" : ""
            }"
            ${isSelf ? "disabled" : ""}
            title="${isSelf ? "Self-role modification is disabled for security." : ""}"
          >
            ${getRoleOptions(user.role || "pending")}
          </select>
          ${
            isSelf
              ? '<p class="mt-2 text-xs text-amber-600 font-medium">Self-role modification is disabled for security.</p>'
              : ""
          }
        </div>
        <div class="flex flex-wrap justify-start gap-3 lg:justify-end">
          <button
            type="button"
            data-save-role
            class="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:-translate-y-0.5 hover:bg-indigo-700"
          >
            ${isPending ? "Approve User" : "Save Role"}
          </button>
        </div>
      </div>
    `;
    usersList.appendChild(li);
  });
}

async function loadUsers() {
  if (!usersList) return;

  usersList.innerHTML = `
    <li class="rounded-[22px] border border-dashed border-slate-200 bg-slate-50/80 px-5 py-6 text-sm text-slate-500">
      <div>
        <strong>Loading users...</strong>
      </div>
    </li>
  `;

  if (usersStatus) {
    usersStatus.textContent = "Syncing user directory...";
  }

  try {
    usersState = await getAllUsers();
    renderUsers();
  } catch (error) {
    console.error("Failed to load users:", error);
    if (usersStatus) {
      usersStatus.textContent = "Failed to load users.";
    }
    usersList.innerHTML = `
      <li class="rounded-[22px] border border-dashed border-rose-200 bg-rose-50/70 px-5 py-6 text-sm text-rose-600">
        <div>
          <strong>Failed to load users.</strong>
          <p class="mt-2">${error.message}</p>
        </div>
      </li>
    `;
  }
}

async function handleSaveRole(button) {
  const item = button.closest("[data-user-id]");
  if (!item) return;

  const userId = item.dataset.userId;
  const roleSelect = item.querySelector("[data-user-role]");
  const selectedRole = roleSelect?.value || "lawyer";
  const currentUser = usersState.find((user) => String(user.id) === String(userId));
  const isPending = currentUser && (!currentUser.is_approved || currentUser.role === "pending");

  try {
    button.disabled = true;
    button.textContent = isPending ? "Approving..." : "Saving...";

    const result = isPending
      ? await approveUser(userId, selectedRole)
      : await updateUserRole(userId, selectedRole);

    usersState = usersState.map((user) =>
      String(user.id) === String(userId) ? result.user : user
    );
    renderUsers();
  } catch (error) {
    console.error("Failed to save user role:", error);
    window.alert(error.message || "Failed to save user role.");
    button.disabled = false;
    button.textContent = isPending ? "Approve User" : "Save Role";
  }
}

if (usersList) {
  usersList.addEventListener("click", (event) => {
    const saveButton = event.target.closest("[data-save-role]");
    if (!saveButton) return;
    handleSaveRole(saveButton);
  });
}

if (goDashboardBtn) {
  goDashboardBtn.addEventListener("click", () => {
    window.location.href = "index.html";
  });
}

if (billingBtn) {
  billingBtn.addEventListener("click", () => {
    window.location.href = "billing.html";
  });
}

if (toggleDarkModeBtn) {
  toggleDarkModeBtn.addEventListener("click", () => {
    const nextTheme = document.body.classList.contains("dark-mode") ? "light" : "dark";
    localStorage.setItem(THEME_KEY, nextTheme);
    applyTheme(nextTheme);
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    if (!window.confirm("Are you sure you want to log out?")) return;
    clearStoredSession();
    window.location.href = "login.html";
  });
}

if (usersSearchForm && usersSearchInput) {
  usersSearchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    usersSearchQuery = usersSearchInput.value || "";
    renderUsers();
  });
}

if (requireAdminSession()) {
  applyTheme(readTheme());
  renderLoggedInUser();
  loadUsers();
}
