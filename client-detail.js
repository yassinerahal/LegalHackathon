const SESSION_KEY = "nextact_current_user";
const THEME_KEY = "nextact_theme";

const clientTitle = document.getElementById("clientTitle");
const clientInfo = document.getElementById("clientInfo");
const clientSettingsForm = document.getElementById("clientSettingsForm");
const clientFullName = document.getElementById("clientFullName");
const clientAddress = document.getElementById("clientAddress");
const clientEmail = document.getElementById("clientEmail");
const clientPhone = document.getElementById("clientPhone");
const clientZipCode = document.getElementById("clientZipCode");
const clientCity = document.getElementById("clientCity");
const clientState = document.getElementById("clientState");
const relatedCasesList = document.getElementById("relatedCasesList");
const relatedCasesSection = document.getElementById("relatedCasesSection");
const deleteClientBtn = document.getElementById("deleteClientBtn");
const goDashboardBtn = document.getElementById("goDashboardBtn");
const loggedInUserName = document.getElementById("loggedInUserName");
const toggleDarkModeBtn = document.getElementById("toggleDarkModeBtn");
const logoutBtn = document.getElementById("logoutBtn");

let currentClientId = null;

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

function getClientIdFromQuery() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

function renderClientPage(client, relatedCases, relatedCasesError = "") {
  clientTitle.textContent = `${client.full_name} Settings`;
  clientFullName.value = client.full_name || "";
  clientAddress.value = client.address || "";
  clientEmail.value = client.email || "";
  clientPhone.value = client.phone || "";
  clientZipCode.value = client.zip_code || "";
  clientCity.value = client.city || "";
  clientState.value = client.state || "";
  clientInfo.textContent = "Update the client profile details here.";
  clientInfo.className = "field-note";
  relatedCasesList.innerHTML = "";

  if (relatedCasesError) {
    relatedCasesList.innerHTML = `
      <li>
        <div>
          <strong>Could not load related cases.</strong>
          <p class="meta">${relatedCasesError}</p>
        </div>
      </li>
    `;
    return;
  }

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
    const badgeClass =
      String(entry.status || "").toLowerCase() === "finished" ? "badge success" : "badge";

    li.innerHTML = `
      <div>
        <strong>${entry.name}</strong>
        <p class="meta">${entry.short_description || "No description"} • Deadline: ${entry.deadline || "Not set"}</p>
      </div>
      <span class="${badgeClass}">${entry.status || "open"}</span>
    `;
    relatedCasesList.appendChild(li);
  });
}

async function handleSaveClient(event) {
  event.preventDefault();

  if (!currentClientId) return;

  const full_name = clientFullName.value.trim();
  const address = clientAddress.value.trim();

  if (!full_name || !address) {
    clientInfo.textContent = "Client name and address are required.";
    clientInfo.className = "field-note error";
    return;
  }

  try {
    const updatedClient = await updateClient(currentClientId, {
      full_name,
      address,
      email: clientEmail.value.trim(),
      phone: clientPhone.value.trim(),
      zip_code: clientZipCode.value.trim(),
      city: clientCity.value.trim(),
      state: clientState.value.trim()
    });

    clientTitle.textContent = `${updatedClient.full_name} Settings`;
    clientInfo.textContent = "Client details saved successfully.";
    clientInfo.className = "field-note success";
  } catch (error) {
    clientInfo.textContent = error.message || "Failed to save client details.";
    clientInfo.className = "field-note error";
  }
}

async function handleDeleteClient() {
  if (!currentClientId) return;

  const confirmed = window.confirm(
    "Are you sure you want to delete this client? This will also remove any cases linked to this client."
  );
  if (!confirmed) return;

  try {
    await deleteClient(currentClientId);
    window.location.href = "clients.html";
  } catch (error) {
    clientInfo.textContent = error.message || "Failed to delete client.";
    clientInfo.className = "field-note error";
  }
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
  if (!window.confirm("Are you sure you want to log out?")) return;
  localStorage.removeItem(SESSION_KEY);
  window.location.href = "login.html";
});

clientSettingsForm.addEventListener("submit", handleSaveClient);
deleteClientBtn.addEventListener("click", handleDeleteClient);

async function initPage() {
  const clientId = getClientIdFromQuery();
  if (!clientId) {
    window.location.href = "clients.html";
    return;
  }

  currentClientId = clientId;

  try {
    const client = await getClientById(clientId);
    let relatedCases = [];
    let relatedCasesError = "";

    try {
      relatedCases = await getClientCases(clientId);
    } catch (error) {
      relatedCasesError = error.message || "Please try again.";
    }

    renderClientPage(client, relatedCases, relatedCasesError);

    if (window.location.hash === "#related-cases" && relatedCasesSection) {
      relatedCasesSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  } catch (error) {
    window.location.href = "clients.html";
  }
}

requireSession();
applyTheme(readTheme());
renderLoggedInUser();
initPage();
