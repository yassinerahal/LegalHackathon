const THEME_KEY = "nextact_theme";

const remoteProfileList = document.getElementById("remoteProfileList");
const remoteCasesList = document.getElementById("remoteCasesList");
const remoteDeadlinesList = document.getElementById("remoteDeadlinesList");
const remoteTimelineList = document.getElementById("remoteTimelineList");
const loggedInUserName = document.getElementById("loggedInUserName");
const toggleDarkModeBtn = document.getElementById("toggleDarkModeBtn");
const logoutBtn = document.getElementById("logoutBtn");

function applyTheme(theme) {
  document.body.classList.toggle("dark-mode", theme === "dark");
  toggleDarkModeBtn.textContent = theme === "dark" ? "☀" : "◐";
}

function readTheme() {
  return localStorage.getItem(THEME_KEY) || "light";
}

function renderLoggedInUser(session) {
  loggedInUserName.textContent = session?.name ? `Hello, ${session.name}` : "";
}

function formatPortalDate(value) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function renderEmptyState(listElement, title, description) {
  listElement.innerHTML = `
    <li>
      <div>
        <strong>${title}</strong>
        <p class="meta">${description}</p>
      </div>
    </li>
  `;
}

function renderProfile(profile) {
  remoteProfileList.innerHTML = `
    <li>
      <div>
        <strong>${profile.full_name || "No name available"}</strong>
        <p class="meta">${profile.email || "No email"} • ${profile.phone || "No phone"}</p>
        <p class="case-doc-status">${profile.address || "No address"} ${profile.city || ""} ${profile.state || ""} ${profile.zip_code || ""}</p>
      </div>
    </li>
  `;
}

function renderCases(cases) {
  remoteCasesList.innerHTML = "";

  if (!cases.length) {
    renderEmptyState(remoteCasesList, "No cases available.", "Cases linked to your client record will appear here.");
    return;
  }

  cases.forEach((entry) => {
    const li = document.createElement("li");
    const badgeClass =
      String(entry.status || "").toLowerCase() === "finished" ? "badge success" : "badge";

    li.innerHTML = `
      <div>
        <strong>${entry.name}</strong>
        <p class="meta">${entry.short_description || "No description"}</p>
        <p class="case-doc-status">Created: ${formatPortalDate(entry.created_at)}</p>
      </div>
      <span class="${badgeClass}">${entry.status || "open"}</span>
    `;
    remoteCasesList.appendChild(li);
  });
}

function renderDeadlines(cases) {
  remoteDeadlinesList.innerHTML = "";

  const deadlines = cases.filter((entry) => entry.deadline);
  if (!deadlines.length) {
    renderEmptyState(remoteDeadlinesList, "No upcoming deadlines.", "Deadlines for your cases will appear here.");
    return;
  }

  deadlines
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .forEach((entry) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <div>
          <strong>${entry.name}</strong>
          <p class="meta">Due: ${formatPortalDate(entry.deadline)}</p>
        </div>
        <span class="badge success">Upcoming</span>
      `;
      remoteDeadlinesList.appendChild(li);
    });
}

function renderTimeline(events) {
  remoteTimelineList.innerHTML = "";

  if (!events.length) {
    renderEmptyState(remoteTimelineList, "No timeline events yet.", "Timeline activity for your cases will appear here.");
    return;
  }

  events.forEach((event) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <div>
        <strong>${event.title} • ${event.case_name}</strong>
        <p class="meta">${event.description}</p>
        <p class="case-doc-status">${formatPortalDate(event.occurred_at)}</p>
      </div>
      <span class="badge">${event.kind}</span>
    `;
    remoteTimelineList.appendChild(li);
  });
}

async function initRemotePortal() {
  const session = requireRemoteUserSession();
  if (!session) return;

  applyTheme(readTheme());
  renderLoggedInUser(session);

  try {
    const [profile, cases, timeline] = await Promise.all([
      getRemoteUserProfile(),
      getRemoteUserCases(),
      getRemoteUserTimeline()
    ]);

    renderProfile(profile);
    renderCases(cases);
    renderDeadlines(cases);
    renderTimeline(timeline);
  } catch (error) {
    renderEmptyState(remoteProfileList, "Failed to load profile.", error.message || "Please try again.");
    renderEmptyState(remoteCasesList, "Failed to load cases.", error.message || "Please try again.");
    renderEmptyState(remoteDeadlinesList, "Failed to load deadlines.", error.message || "Please try again.");
    renderEmptyState(remoteTimelineList, "Failed to load timeline.", error.message || "Please try again.");
  }
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

initRemotePortal();
