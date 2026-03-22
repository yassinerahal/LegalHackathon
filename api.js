const API_BASE_URL = "http://localhost:3000/api";
const STORED_SESSION_KEY = "nextact_current_user";

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
}

function getSessionToken() {
  return getStoredSession()?.token || "";
}

function getSessionHomePath(session = getStoredSession()) {
  return session?.role === "remote_user" ? "remote-portal.html" : "index.html";
}

function requireStaffSession() {
  const session = getStoredSession();
  if (!session) {
    window.location.href = "login.html";
    return null;
  }

  if (session.role === "remote_user") {
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

  if (session.role !== "remote_user") {
    window.location.href = "index.html";
    return null;
  }

  return session;
}

function buildAuthHeaders() {
  const token = getSessionToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiRequest(path, options = {}) {
  const headers = {
    ...buildAuthHeaders(),
    ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers || {})
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
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
    throw new Error(data?.error || "Request failed");
  }

  return data;
}

async function getCases() {
  return apiRequest("/cases");
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
  return apiRequest("/auth/signup", {
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

async function linkPlaceholderToDocument(caseId, placeholderId, payload) {
  return apiRequest(`/cases/${encodeURIComponent(caseId)}/placeholders/${encodeURIComponent(placeholderId)}/link`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}
