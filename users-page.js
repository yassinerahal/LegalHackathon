const SESSION_KEY = "nextact_current_user";
const THEME_KEY = "nextact_theme";

const usersList = document.getElementById("usersList");
const usersStatus = document.getElementById("usersStatus");
const goDashboardBtn = document.getElementById("goDashboardBtn");
const loggedInUserName = document.getElementById("loggedInUserName");
const toggleDarkModeBtn = document.getElementById("toggleDarkModeBtn");
const billingBtn = document.getElementById("billingBtn");
const logoutBtn = document.getElementById("logoutBtn");

let usersState = [];

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
  } catch (error) {
    loggedInUserName.textContent = "";
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

  const pendingCount = usersState.filter((user) => !user.is_approved || user.role === "pending").length;
  if (usersStatus) {
    usersStatus.textContent = `${usersState.length} users loaded. ${pendingCount} waiting for approval.`;
  }

  usersState.forEach((user) => {
    const isPending = !user.is_approved || user.role === "pending";
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
            class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
          >
            ${getRoleOptions(user.role || "pending")}
          </select>
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

if (requireAdminSession()) {
  applyTheme(readTheme());
  renderLoggedInUser();
  loadUsers();
}
