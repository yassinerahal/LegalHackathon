const SESSION_KEY = "nextact_current_user";
const THEME_KEY = "nextact_theme";

const clientTitle = document.getElementById("clientTitle");
const clientInfo = document.getElementById("clientInfo");
const remoteAccessInfo = document.getElementById("remoteAccessInfo");
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
const grantRemoteAccessBtn = document.getElementById("grantRemoteAccessBtn");
const deleteClientBtn = document.getElementById("deleteClientBtn");
const remoteAccessDialog = document.getElementById("remoteAccessDialog");
const remoteAccessLink = document.getElementById("remoteAccessLink");
const remoteAccessQr = document.getElementById("remoteAccessQr");
const remoteAccessExpiry = document.getElementById("remoteAccessExpiry");
const copyRemoteAccessBtn = document.getElementById("copyRemoteAccessBtn");
const closeRemoteAccessBtn = document.getElementById("closeRemoteAccessBtn");
const goDashboardBtn = document.getElementById("goDashboardBtn");
const loggedInUserName = document.getElementById("loggedInUserName");
const toggleDarkModeBtn = document.getElementById("toggleDarkModeBtn");
const logoutBtn = document.getElementById("logoutBtn");

let currentClientId = null;

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

function getClientIdFromQuery() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function setClientTitle(name) {
  clientTitle.innerHTML = `<img src="icons/client-person-icon.svg" alt="" aria-hidden="true" />${name} Settings`;
}

function updateRemoteAccessAvailability(client) {
  const hasEmail = Boolean(client.email && String(client.email).trim());
  grantRemoteAccessBtn.disabled = !hasEmail;
  remoteAccessInfo.textContent = hasEmail
    ? "Remote access creates a one-time setup link for this client."
    : "Remote access can only be granted to clients with an email address.";
  remoteAccessInfo.className = hasEmail ? "field-note" : "field-note error";
}

function renderClientPage(client, relatedCases, relatedCasesError = "") {
  setClientTitle(client.full_name);
  clientFullName.value = client.full_name || "";
  clientAddress.value = client.address || "";
  clientEmail.value = client.email || "";
  clientPhone.value = client.phone || "";
  clientZipCode.value = client.zip_code || "";
  clientCity.value = client.city || "";
  clientState.value = client.state || "";
  clientInfo.textContent = "Update the client profile details here.";
  clientInfo.className = "field-note";
  updateRemoteAccessAvailability(client);
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

    setClientTitle(updatedClient.full_name);
    clientInfo.textContent = "Client details saved successfully.";
    clientInfo.className = "field-note success";
    updateRemoteAccessAvailability(updatedClient);
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

async function handleGrantRemoteAccess() {
  if (!currentClientId) return;

  if (!clientEmail.value.trim()) {
    remoteAccessInfo.textContent = "Remote access can only be granted to clients with an email address.";
    remoteAccessInfo.className = "field-note error";
    return;
  }

  try {
    const result = await giveRemoteAccess(currentClientId);
    remoteAccessLink.value = result.setup_link;
    remoteAccessQr.src = result.qr_code_data_url;
    remoteAccessExpiry.textContent = `Expires: ${formatDateTime(result.expires_at)}`;
    remoteAccessDialog.showModal();

    remoteAccessInfo.textContent = "One-time remote access link generated successfully.";
    remoteAccessInfo.className = "field-note success";
  } catch (error) {
    remoteAccessInfo.textContent = error.message || "Failed to grant remote access.";
    remoteAccessInfo.className = "field-note error";
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
  clearStoredSession();
  window.location.href = "login.html";
});

clientSettingsForm.addEventListener("submit", handleSaveClient);
grantRemoteAccessBtn.addEventListener("click", handleGrantRemoteAccess);
deleteClientBtn.addEventListener("click", handleDeleteClient);
clientEmail.addEventListener("input", () => {
  updateRemoteAccessAvailability({ email: clientEmail.value });
});
copyRemoteAccessBtn.addEventListener("click", async () => {
  if (!remoteAccessLink.value) return;
  await navigator.clipboard.writeText(remoteAccessLink.value);
  copyRemoteAccessBtn.textContent = "Copied";
  window.setTimeout(() => {
    copyRemoteAccessBtn.textContent = "Copy Link";
  }, 1200);
});
closeRemoteAccessBtn.addEventListener("click", () => {
  remoteAccessDialog.close();
});

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
