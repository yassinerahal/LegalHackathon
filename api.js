const API_BASE_URL = "http://localhost:3000/api";
const STORED_SESSION_KEY = "nextact_current_user";
const STORED_JWT_KEY = "nextact_jwt";
const SUPPORTED_UPLOAD_EXTENSIONS = [
  ".pdf",
  ".xlsx",
  ".xls",
  ".png",
  ".jpg",
  ".jpeg",
  ".doc",
  ".docx",
  ".csv",
  ".txt"
];
const SUPPORTED_UPLOAD_ACCEPT = SUPPORTED_UPLOAD_EXTENSIONS.join(",");

function getApiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

function isSupportedUploadFile(file) {
  const fileName = String(file?.name || "").toLowerCase();
  return SUPPORTED_UPLOAD_EXTENSIONS.some((extension) => fileName.endsWith(extension));
}

function getStoredSession() {
  try {
    const raw = localStorage.getItem(STORED_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function clearStoredSession() {
  localStorage.removeItem(STORED_SESSION_KEY);
  localStorage.removeItem(STORED_JWT_KEY);
}

function setSessionToken(token) {
  if (token) {
    localStorage.setItem(STORED_JWT_KEY, token);
    return;
  }

  localStorage.removeItem(STORED_JWT_KEY);
}

function getSessionToken() {
  return localStorage.getItem(STORED_JWT_KEY) || getStoredSession()?.token || "";
}

function decodeJwtPayload(token) {
  try {
    const payload = String(token || "").split(".")[1] || "";
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(atob(padded));
  } catch (error) {
    return null;
  }
}

function getAuthUser() {
  return decodeJwtPayload(getSessionToken());
}

function updateNavbarAuthUi() {
  const authUser = getAuthUser();
  const usersLink = document.getElementById("nav-users-link");
  const roleLabel = document.getElementById("nav-user-role");

  if (usersLink) {
    usersLink.classList.add("hidden");
    if (authUser?.role === "admin") {
      usersLink.classList.remove("hidden");
    }
  }

  if (roleLabel) {
    roleLabel.textContent = authUser?.role ? String(authUser.role).toUpperCase() : "";
  }
}

function isFirmRole(role) {
  return ["admin", "lawyer", "assistant"].includes(role);
}

function canCreateCases(session = getStoredSession()) {
  return session?.role === "admin" || session?.role === "lawyer";
}

function canEditCase(session = getStoredSession(), entry = null) {
  if (!session || !entry) return false;
  if (session.role === "admin") return true;
  if (session.role === "lawyer") return Boolean(entry.can_edit || entry.is_owner || entry.is_assigned);
  if (session.role === "assistant") return Boolean(entry.can_edit || entry.is_assigned);
  return false;
}

function getSessionHomePath(session = getStoredSession()) {
  return session?.role === "client" ? "remote-portal.html" : "index.html";
}

function requireStaffSession() {
  const session = getStoredSession();
  if (!session) {
    window.location.href = "login.html";
    return null;
  }

  if (!session.isApproved) {
    clearStoredSession();
    window.location.href = "login.html";
    return null;
  }

  if (!isFirmRole(session.role)) {
    window.location.href = "remote-portal.html";
    return null;
  }

  return session;
}

function requireRemoteUserSession() {
  const session = getStoredSession();
  if (!session) {
    window.location.href = "login.html";
    return null;
  }

  if (!session.isApproved) {
    clearStoredSession();
    window.location.href = "login.html";
    return null;
  }

  if (session.role !== "client") {
    window.location.href = "index.html";
    return null;
  }

  return session;
}

function buildAuthHeaders() {
  const token = getSessionToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function shouldHandleSessionExpiry(path, responseStatus) {
  if (![401, 403].includes(responseStatus)) {
    return false;
  }

  return !path.startsWith("/auth/login") && !path.startsWith("/auth/register") && !path.startsWith("/auth/signup");
}

async function apiRequest(path, options = {}) {
  const headers = {
    ...buildAuthHeaders(),
    ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers || {})
  };

  const response = await fetch(getApiUrl(path), {
    ...options,
    headers
  });

  let data = null;
  try {
    data = await response.json();
  } catch (error) {
    data = null;
  }

  if (!response.ok) {
    if (shouldHandleSessionExpiry(path, response.status)) {
      clearStoredSession();
      window.location.href = "login.html";
    }
    throw new Error(data?.error || "Request failed");
  }

  return data;
}

async function getCases(filter = "all") {
  const normalizedFilter = filter === "my-cases" ? "my-cases" : "all";
  const query = normalizedFilter === "all" ? "" : `?filter=${encodeURIComponent(normalizedFilter)}`;
  console.log("Frontend sending filter:", normalizedFilter);
  return apiRequest(`/cases${query}`);
}

async function getCaseById(id) {
  return apiRequest(`/cases/${encodeURIComponent(id)}`);
}

async function createCase(payload) {
  return apiRequest("/cases", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

async function getCasePatternSetting() {
  return apiRequest("/settings/case-pattern");
}

async function updateCasePatternSetting(pattern) {
  return apiRequest("/admin/settings/case-pattern", {
    method: "PUT",
    body: JSON.stringify({ pattern })
  });
}

async function updateCase(id, payload) {
  return apiRequest(`/cases/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

async function deleteCase(id) {
  return apiRequest(`/cases/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
}

async function getClients() {
  return apiRequest("/clients");
}

async function getClientById(id) {
  return apiRequest(`/clients/${encodeURIComponent(id)}`);
}

async function getClientCases(id) {
  return apiRequest(`/clients/${encodeURIComponent(id)}/cases`);
}

async function createClient(payload) {
  return apiRequest("/clients", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

async function updateClient(id, payload) {
  return apiRequest(`/clients/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

async function deleteClient(id) {
  return apiRequest(`/clients/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
}

async function giveRemoteAccess(id) {
  return apiRequest(`/clients/${encodeURIComponent(id)}/remote-access`, {
    method: "POST"
  });
}

async function getRemoteSetupInfo(token) {
  return apiRequest(`/remote-access/setup?token=${encodeURIComponent(token)}`);
}

async function completeRemoteSetup(payload) {
  return apiRequest("/remote-access/setup", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

async function getRemoteUserProfile() {
  return apiRequest("/remote-user/profile");
}

async function getRemoteUserCases() {
  return apiRequest("/remote-user/cases");
}

async function getRemoteUserTimeline() {
  return apiRequest("/remote-user/timeline");
}

async function signup(payload) {
  return apiRequest("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

async function login(payload) {
  return apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

async function uploadFile(file) {
  const formData = new FormData();
  formData.append("document", file);
  return apiRequest("/upload", {
    method: "POST",
    body: formData
  });
}

async function linkCaseDocument(caseId, payload) {
  return apiRequest(`/cases/${encodeURIComponent(caseId)}/documents`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

async function getCaseDocuments(caseId) {
  return apiRequest(`/cases/${encodeURIComponent(caseId)}/documents`);
}

async function createCasePlaceholders(caseId, placeholders) {
  return apiRequest(`/cases/${encodeURIComponent(caseId)}/placeholders`, {
    method: "POST",
    body: JSON.stringify(placeholders)
  });
}

async function getCasePlaceholders(caseId) {
  return apiRequest(`/cases/${encodeURIComponent(caseId)}/placeholders`);
}

async function deleteCasePlaceholder(caseId, placeholderId) {
  return apiRequest(`/cases/${encodeURIComponent(caseId)}/placeholders/${encodeURIComponent(placeholderId)}`, {
    method: "DELETE"
  });
}

async function linkPlaceholderToDocument(caseId, placeholderId, payload) {
  return apiRequest(`/cases/${encodeURIComponent(caseId)}/placeholders/${encodeURIComponent(placeholderId)}/link`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

async function uploadPlaceholderVersion(caseId, placeholderId, payload) {
  return apiRequest(`/cases/${encodeURIComponent(caseId)}/placeholders/${encodeURIComponent(placeholderId)}/upload`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

async function getPlaceholderHistory(placeholderId) {
  return apiRequest(`/placeholders/${encodeURIComponent(placeholderId)}/history`);
}

async function getPendingUsers() {
  return apiRequest("/admin/users/pending");
}

async function getAllUsers() {
  return apiRequest("/admin/users");
}

async function approveUser(id, role) {
  return apiRequest(`/admin/users/${encodeURIComponent(id)}/approve`, {
    method: "PUT",
    body: JSON.stringify({ role })
  });
}

async function updateUserRole(id, role) {
  return apiRequest(`/admin/users/${encodeURIComponent(id)}/role`, {
    method: "PUT",
    body: JSON.stringify({ role })
  });
}

async function assignUserToCase(caseId, userId) {
  return apiRequest(`/cases/${encodeURIComponent(caseId)}/assign`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId })
  });
}

async function getAssignableUsers() {
  return apiRequest("/users/assignable");
}

async function getCaseAssignments(caseId) {
  return apiRequest(`/cases/${encodeURIComponent(caseId)}/assignments`);
}
