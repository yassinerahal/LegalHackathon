const API_BASE_URL = "http://localhost:3000/api";

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
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
