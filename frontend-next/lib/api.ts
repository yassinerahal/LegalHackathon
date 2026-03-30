import {
  AdminUser,
  AuthResponse,
  CaseDocument,
  CaseAssignmentUser,
  CaseEntry,
  CasePlaceholder,
  ClientEntry,
  RemoteTimelineEvent
} from "@/lib/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000/api";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function getApiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

type ApiRequestOptions = RequestInit & {
  token?: string | null;
};

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers || {});

  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(getApiUrl(path), {
    ...options,
    headers
  });

  let data: unknown = null;
  try {
    data = await response.json();
  } catch (error) {
    data = null;
  }

  if (!response.ok) {
    const message =
      typeof data === "object" && data && "error" in data
        ? String((data as { error: string }).error)
        : "Request failed";
    throw new ApiError(message, response.status);
  }

  return data as T;
}

export async function loginRequest(
  credentials: { identifier: string; password: string }
): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials)
  });
}

export async function getCases(token: string): Promise<CaseEntry[]> {
  return apiRequest<CaseEntry[]>("/cases", { token });
}

export async function downloadDocument(
  payload: { s3Key: string; fileName: string },
  token: string
): Promise<Blob> {
  const response = await fetch(
    getApiUrl(`/documents/${encodeURIComponent(payload.s3Key)}/download?name=${encodeURIComponent(payload.fileName)}`),
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  if (!response.ok) {
    const message = await response.text();
    throw new ApiError(message || "Failed to download document", response.status);
  }

  return response.blob();
}

export async function createCase(
  payload: {
    name: string;
    client_id: number;
    status?: string;
    deadline?: string | null;
    short_description?: string;
  },
  token: string
): Promise<CaseEntry> {
  return apiRequest<CaseEntry>("/cases", {
    method: "POST",
    body: JSON.stringify(payload),
    token
  });
}

export async function getCaseById(caseId: string, token: string): Promise<CaseEntry> {
  return apiRequest<CaseEntry>(`/cases/${encodeURIComponent(caseId)}`, { token });
}

export async function updateCase(
  caseId: string,
  payload: {
    name: string;
    client_id: number;
    status?: string;
    deadline?: string | null;
    short_description?: string;
  },
  token: string
): Promise<CaseEntry> {
  return apiRequest<CaseEntry>(`/cases/${encodeURIComponent(caseId)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
    token
  });
}

export async function getCaseAssignments(caseId: string, token: string): Promise<CaseAssignmentUser[]> {
  return apiRequest<CaseAssignmentUser[]>(`/cases/${encodeURIComponent(caseId)}/assignments`, { token });
}

export async function assignUserToCase(caseId: string, userId: number, token: string) {
  return apiRequest(`/cases/${encodeURIComponent(caseId)}/assign`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
    token
  });
}

export async function getAssignableUsers(token: string): Promise<AdminUser[]> {
  return apiRequest<AdminUser[]>("/users/assignable", { token });
}

export async function getCaseDocuments(caseId: string, token: string): Promise<CaseDocument[]> {
  return apiRequest<CaseDocument[]>(`/cases/${encodeURIComponent(caseId)}/documents`, { token });
}

export async function getCasePlaceholders(caseId: string, token: string): Promise<CasePlaceholder[]> {
  return apiRequest<CasePlaceholder[]>(`/cases/${encodeURIComponent(caseId)}/placeholders`, { token });
}

export async function createCasePlaceholders(
  caseId: string,
  placeholders: Array<{ name: string; status?: string; attached_files?: unknown[] }>,
  token: string
): Promise<CasePlaceholder[]> {
  return apiRequest<CasePlaceholder[]>(`/cases/${encodeURIComponent(caseId)}/placeholders`, {
    method: "POST",
    body: JSON.stringify(placeholders),
    token
  });
}

export async function uploadFile(file: File, token: string): Promise<{
  filePath: string;
  encryption_iv: string;
  encryption_tag: string;
}> {
  const formData = new FormData();
  formData.append("document", file);

  return apiRequest("/upload", {
    method: "POST",
    body: formData,
    token
  });
}

export async function linkDocumentToCase(
  caseId: string,
  payload: {
    original_name: string;
    s3_key: string;
    mime_type: string;
    encryption_iv: string;
    encryption_tag: string;
  },
  token: string
): Promise<CaseDocument> {
  return apiRequest<CaseDocument>(`/cases/${encodeURIComponent(caseId)}/documents`, {
    method: "POST",
    body: JSON.stringify(payload),
    token
  });
}

export async function linkPlaceholderToDocument(
  caseId: string,
  placeholderId: number,
  payload: {
    original_name: string;
    s3_key: string;
    mime_type: string;
    encryption_iv: string;
    encryption_tag: string;
  },
  token: string
): Promise<CasePlaceholder> {
  return apiRequest<CasePlaceholder>(
    `/cases/${encodeURIComponent(caseId)}/placeholders/${encodeURIComponent(String(placeholderId))}/link`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
      token
    }
  );
}

export async function getClients(token: string): Promise<ClientEntry[]> {
  return apiRequest<ClientEntry[]>("/clients", { token });
}

export async function createClient(
  payload: {
    full_name: string;
    email?: string;
    phone?: string;
    address?: string;
    zip_code?: string;
    city?: string;
    state?: string;
  },
  token: string
): Promise<ClientEntry> {
  return apiRequest<ClientEntry>("/clients", {
    method: "POST",
    body: JSON.stringify(payload),
    token
  });
}

export async function getAllUsers(token: string): Promise<AdminUser[]> {
  return apiRequest<AdminUser[]>("/admin/users", { token });
}

export async function updateUserRole(
  userId: number,
  role: "admin" | "lawyer" | "assistant" | "client",
  token: string
): Promise<{ user: AdminUser }> {
  return apiRequest<{ user: AdminUser }>(`/admin/users/${encodeURIComponent(String(userId))}/role`, {
    method: "PUT",
    body: JSON.stringify({ role }),
    token
  });
}

export async function getRemoteUserProfile(token: string): Promise<ClientEntry> {
  return apiRequest<ClientEntry>("/remote-user/profile", { token });
}

export async function getRemoteUserCases(token: string): Promise<CaseEntry[]> {
  return apiRequest<CaseEntry[]>("/remote-user/cases", { token });
}

export async function getRemoteUserTimeline(token: string): Promise<RemoteTimelineEvent[]> {
  return apiRequest<RemoteTimelineEvent[]>("/remote-user/timeline", { token });
}
