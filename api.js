const API_BASE_URL = "http://localhost:3000/api";

async function apiRequest(path, options = {}) {
  const headers = {
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

async function confirmCaseDocument(caseId, payload) {
  return apiRequest(`/cases/${encodeURIComponent(caseId)}/documents/confirm`, {
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

async function linkPlaceholderToDocument(caseId, placeholderId, s3Key) {
  return apiRequest(`/cases/${encodeURIComponent(caseId)}/placeholders/${encodeURIComponent(placeholderId)}/link`, {
    method: "PUT",
    body: JSON.stringify({ s3_key: s3Key })
  });
}
