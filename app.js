const INITIAL_CASES = [];
const DEFAULT_DEADLINES = [];

const state = {
  cases: [],
  deadlines: [],
  clients: [],
  documents: 0,
  casePatternSetting: null
};

const dashboardMain = document.querySelector(".dashboard-main");
const activeCases = document.getElementById("activeCases");
const totalClients = document.getElementById("totalClients");
const upcomingDeadlines = document.getElementById("upcomingDeadlines");
const pendingDocs = document.getElementById("pendingDocs");
const caseList = document.getElementById("caseList");
const deadlineList = document.getElementById("deadlineList");
const clientList = document.getElementById("clientList");
const calendarBtn = document.getElementById("calendarBtn");
const viewAllCasesBtn = document.getElementById("viewAllCasesBtn");
const viewAllClientsBtn = document.getElementById("viewAllClientsBtn");
const newCaseMainBtn = document.getElementById("newCaseMainBtn");
const loggedInUserName = document.getElementById("loggedInUserName");
const quickUploadDropZone = document.getElementById("quickUploadDropZone");
const quickUploadDocuments = document.getElementById("quickUploadDocuments");
const quickUploadStatus = document.getElementById("quickUploadStatus");
const assignUploadModal = document.getElementById("assignUploadModal");
const assignUploadFileCount = document.getElementById("assignUploadFileCount");
const assignUploadCaseSelect = document.getElementById("assignUploadCaseSelect");
const cancelAssignUploadBtn = document.getElementById("cancelAssignUploadBtn");
const confirmAssignUploadBtn = document.getElementById("confirmAssignUploadBtn");
const toggleDarkModeBtn = document.getElementById("toggleDarkModeBtn");
const casePatternWarning = document.getElementById("casePatternWarning");
const casePatternAdminCard = document.getElementById("casePatternAdminCard");
const casePatternInput = document.getElementById("casePatternInput");
const casePatternStatus = document.getElementById("casePatternStatus");
const saveCasePatternBtn = document.getElementById("saveCasePatternBtn");
const lawyerCaseFilter = document.getElementById("lawyerCaseFilter");

const quickAddModal = document.getElementById("quickAddModal");
const modalTitle = document.getElementById("modalTitle");
const closeModalBtn = document.getElementById("closeModalBtn");
const newItemBtn = document.getElementById("newItemBtn");
const logoutBtn = document.getElementById("logoutBtn");
const billingBtn = document.getElementById("billingBtn");
const cancelBtn = document.getElementById("cancelBtn");
const saveBtn = document.getElementById("saveBtn");
const caseNumberPreview = document.getElementById("caseNumberPreview");
const caseName = document.getElementById("caseName");
const clientNames = document.getElementById("clientNames");
const clientStatus = document.getElementById("clientStatus");
const showClientFormBtn = document.getElementById("showClientFormBtn");
const clientForm = document.getElementById("clientForm");
const clientFullName = document.getElementById("clientFullName");
const clientAddress = document.getElementById("clientAddress");
const clientEmail = document.getElementById("clientEmail");
const clientPhone = document.getElementById("clientPhone");
const saveClientBtn = document.getElementById("saveClientBtn");
const caseStatus = document.getElementById("caseStatus");
const caseDeadline = document.getElementById("caseDeadline");
const caseDescription = document.getElementById("caseDescription");
const caseComment = document.getElementById("caseComment");
const dropZone = document.getElementById("dropZone");
const caseDocuments = document.getElementById("caseDocuments");
const fileCount = document.getElementById("fileCount");
const uploadedFileBoxes = document.getElementById("uploadedFileBoxes");
const screenDropOverlay = document.getElementById("screenDropOverlay");
const docPlaceholderName = document.getElementById("docPlaceholderName");
const docPlaceholderStatus = document.getElementById("docPlaceholderStatus");
const addDocPlaceholderBtn = document.getElementById("addDocPlaceholderBtn");
const docPlaceholderList = document.getElementById("docPlaceholderList");
const caseTeamSection = document.getElementById("caseTeamSection");
const caseTeamList = document.getElementById("caseTeamList");

let selectedFiles = [];
let currentUploadedDocuments = [];
let newUploadNames = new Set();
let dragDepth = 0;
let editingCaseId = null;
let currentDocPlaceholders = [];
let pendingQuickUploadFiles = [];
let assignableCaseUsers = [];
let selectedCaseAssigneeIds = new Set();
let toastTimeouts = new WeakMap();
let currentCaseFilter = "all";
const SESSION_KEY = "nextact_current_user";
const CASES_KEY = "nextact_cases";
const THEME_KEY = "nextact_theme";

function ensureUploadInputHints() {
  [quickUploadDocuments, caseDocuments].forEach((input) => {
    if (input) {
      input.setAttribute("accept", SUPPORTED_UPLOAD_ACCEPT);
    }
  });
}

function getToastRegion() {
  let region = document.getElementById("toastRegion");
  if (!region) {
    region = document.createElement("div");
    region.id = "toastRegion";
    region.className = "toast-region";
    region.setAttribute("aria-live", "polite");
    region.setAttribute("aria-atomic", "true");
    document.body.appendChild(region);
  }
  return region;
}

function showToast(message, variant = "success") {
  if (!message) return;
  const region = getToastRegion();
  const toast = document.createElement("div");
  toast.className = `toast-message ${variant}`;
  toast.textContent = message;
  region.appendChild(toast);

  window.requestAnimationFrame(() => {
    toast.classList.add("visible");
  });

  const timeoutId = window.setTimeout(() => {
    toast.classList.remove("visible");
    window.setTimeout(() => toast.remove(), 220);
  }, 4200);

  toastTimeouts.set(toast, timeoutId);
  toast.addEventListener("click", () => {
    window.clearTimeout(toastTimeouts.get(toast));
    toast.classList.remove("visible");
    window.setTimeout(() => toast.remove(), 220);
  });
}

function splitUploadFiles(files) {
  const supportedFiles = [];
  const unsupportedFiles = [];

  Array.from(files || []).forEach((file) => {
    if (isSupportedUploadFile(file)) {
      supportedFiles.push(file);
    } else {
      unsupportedFiles.push(file.name || "Unknown file");
    }
  });

  return { supportedFiles, unsupportedFiles };
}

function requireSession() {
  return requireStaffSession();
}

function applyTheme(theme) {
  document.body.classList.toggle("dark-mode", theme === "dark");
  toggleDarkModeBtn.textContent = theme === "dark" ? "☀" : "◐";
  toggleDarkModeBtn.title = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
}

function readTheme() {
  return localStorage.getItem(THEME_KEY) || "light";
}

if (billingBtn) {
  billingBtn.addEventListener("click", () => {
    window.location.href = "billing.html";
  });
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

function readStoredCases() {
  const raw = localStorage.getItem(CASES_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function sanitizeDocumentForStorage(document) {
  if (!document || !document.name) return null;

  return {
    name: document.name,
    mimeType: document.mimeType || "",
    s3Key: document.s3Key || "",
    encryptionIv: document.encryptionIv || "",
    encryptionTag: document.encryptionTag || "",
    uploadedAt: document.uploadedAt || ""
  };
}

function sanitizeCaseForStorage(entry) {
  return {
    ...entry,
    requiredDocuments: (entry.requiredDocuments || []).map((document) => ({
      id: document.id,
      name: document.name,
      status: document.status || "Pending",
      attachedFiles: Array.isArray(document.attachedFiles) ? document.attachedFiles : []
    })),
    uploadedDocuments: (entry.uploadedDocuments || [])
      .map(sanitizeDocumentForStorage)
      .filter(Boolean)
  };
}

function writeStoredCases(cases) {
  localStorage.setItem(CASES_KEY, JSON.stringify(cases.map(sanitizeCaseForStorage)));
}

function getConfiguredCasePattern() {
  return state.casePatternSetting?.pattern || "";
}

function isCasePatternConfigured() {
  return Boolean(getConfiguredCasePattern());
}

function applyCaseCreationLock(session = getStoredSession()) {
  if (!newCaseMainBtn) return;

  const canCreate = canCreateCases(session);
  const isLocked = canCreate && !isCasePatternConfigured();

  newCaseMainBtn.hidden = !canCreate;
  newCaseMainBtn.disabled = isLocked;
  newCaseMainBtn.classList.toggle("opacity-50", isLocked);
  newCaseMainBtn.classList.toggle("cursor-not-allowed", isLocked);
  newCaseMainBtn.classList.toggle("pointer-events-none", isLocked);

  if (casePatternWarning) {
    casePatternWarning.classList.toggle("hidden", !isLocked);
  }
}

function renderCasePatternAdminCard(session = getStoredSession()) {
  if (!casePatternAdminCard || !casePatternInput || !casePatternStatus || !saveCasePatternBtn) return;

  const isAdmin = session?.role === "admin";
  casePatternAdminCard.classList.toggle("hidden", !isAdmin);
  if (!isAdmin) return;

  casePatternInput.value = getConfiguredCasePattern();
  casePatternStatus.textContent = isCasePatternConfigured()
    ? `Current pattern: ${getConfiguredCasePattern()}`
    : "No case number pattern configured yet.";
  casePatternStatus.className = `mt-3 text-sm ${
    isCasePatternConfigured() ? "text-slate-500" : "text-red-700"
  }`;
}

function renderLawyerCaseFilter(session = getStoredSession()) {
  if (!lawyerCaseFilter) return;
  const isLawyer = session?.role === "lawyer";
  lawyerCaseFilter.classList.toggle("hidden", !isLawyer);
  if (!isLawyer) return;

  lawyerCaseFilter.querySelectorAll("[data-filter]").forEach((button) => {
    const isActive = button.dataset.filter === currentCaseFilter;
    button.classList.toggle("bg-white", isActive);
    button.classList.toggle("shadow-sm", isActive);
    button.classList.toggle("text-slate-800", isActive);
    button.classList.toggle("text-slate-500", !isActive);
  });
}

async function initDashboard() {
  const session = requireSession();
  if (!session) return;
  applyTheme(readTheme());
  renderLoggedInUser();
  currentCaseFilter = session.role === "lawyer" ? "my-cases" : "all";
  ensureUploadInputHints();
  try {
    const requests = [getCases(currentCaseFilter), getClients(), getCasePatternSetting()];
    if (session.role === "admin" || session.role === "lawyer") {
      requests.push(getAssignableUsers());
    }

    const responses = await Promise.all(requests);
    const cases = responses.shift() || [];
    const clients = responses.shift() || [];
    state.casePatternSetting = responses.shift() || null;
    const assignableUsers =
      session.role === "admin" || session.role === "lawyer" ? responses.shift() || [] : [];
    const storedCasesById = new Map(readStoredCases().map((entry) => [String(entry.id), entry]));

    state.cases = cases.map((entry) => ({
      id: entry.id,
      title: entry.name,
      caseNumber: entry.case_number || "",
      stage: entry.short_description || "No description",
      client_id: entry.client_id,
      owner_id: entry.owner_id || null,
      clientNames: entry.client_name ? [entry.client_name] : [],
      status: entry.status || "open",
      can_edit: Boolean(entry.can_edit),
      is_owner: Boolean(entry.is_owner),
      is_assigned: Boolean(entry.is_assigned),
      deadline: entry.deadline || "",
      comments: storedCasesById.get(String(entry.id))?.comments || [],
      requiredDocuments: storedCasesById.get(String(entry.id))?.requiredDocuments || [],
      uploadedDocuments: normalizeUploadedDocuments(
        storedCasesById.get(String(entry.id))?.uploadedDocuments || []
      )
    }));
    state.clients = clients.map((client) => ({
      id: client.id,
      name: client.full_name,
      address: client.address || "",
      email: client.email || "",
      phone: client.phone || ""
    }));
    state.deadlines = state.cases
      .filter((entry) => entry.deadline)
      .map((entry) => ({
        title: `${entry.title} deadline`,
        date: entry.deadline
      }));
    state.documents = state.cases.reduce(
      (total, entry) => total + (Array.isArray(entry.uploadedDocuments) ? entry.uploadedDocuments.length : 0),
      0
    );
    assignableCaseUsers = Array.isArray(assignableUsers) ? assignableUsers : [];
    writeStoredCases(state.cases);
    applyCaseCreationLock(session);
    render();
    hydrateDashboardDocuments(cases);
  } catch (error) {
    console.error(error);
  }
}

initDashboard();

async function hydrateDashboardDocuments(cases) {
  if (!Array.isArray(cases) || !cases.length) return;

  const documentResults = await Promise.allSettled(
    cases.map(async (entry) => ({
      caseId: String(entry.id),
      documents: await getCaseDocuments(entry.id)
    }))
  );

  let hasUpdates = false;

  documentResults.forEach((result) => {
    if (result.status !== "fulfilled") return;

    const normalizedDocuments = result.value.documents.map((document) => ({
      name: document.original_name,
      previewUrl: "",
      mimeType: document.mime_type || "",
      s3Key: document.s3_key,
      encryptionIv: document.encryption_iv || "",
      encryptionTag: document.encryption_tag || "",
      uploadedAt: document.uploaded_at || ""
    }));

    const caseIndex = state.cases.findIndex((entry) => String(entry.id) === result.value.caseId);
    if (caseIndex < 0) return;

    const currentDocs = normalizeUploadedDocuments(state.cases[caseIndex].uploadedDocuments);
    const currentSignature = JSON.stringify(currentDocs.map((doc) => [doc.name, doc.s3Key, doc.uploadedAt]));
    const nextSignature = JSON.stringify(normalizedDocuments.map((doc) => [doc.name, doc.s3Key, doc.uploadedAt]));

    if (currentSignature === nextSignature) return;

    state.cases[caseIndex] = {
      ...state.cases[caseIndex],
      uploadedDocuments: normalizedDocuments
    };
    hasUpdates = true;
  });

  if (!hasUpdates) return;

  state.documents = state.cases.reduce(
    (total, entry) => total + (Array.isArray(entry.uploadedDocuments) ? entry.uploadedDocuments.length : 0),
    0
  );
  writeStoredCases(state.cases);
  render();
}

function normalizeName(value) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function findClientByName(name) {
  const lookup = normalizeName(name);
  return state.clients.find((client) => normalizeName(client.name) === lookup);
}

function parseClientNames(value) {
  const unique = [];
  const seen = new Set();
  value
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
    .forEach((name) => {
      const normalized = normalizeName(name);
      if (!seen.has(normalized)) {
        seen.add(normalized);
        unique.push(name);
      }
    });
  return unique;
}

function formatDate(dateValue) {
  if (!dateValue) return "TBD";

  let date = null;

  if (typeof dateValue === "string") {
    const normalized = dateValue.trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      date = new Date(`${normalized}T00:00:00`);
    } else if (/^\d{2}\.\d{2}\.\d{4}$/.test(normalized)) {
      const [day, month, year] = normalized.split(".");
      date = new Date(`${year}-${month}-${day}T00:00:00`);
    } else {
      date = new Date(normalized);
    }
  } else {
    date = new Date(dateValue);
  }

  if (Number.isNaN(date.getTime())) {
    return String(dateValue);
  }

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function isDeadlineSoon(dateValue) {
  if (!dateValue) return false;
  const dueDate = new Date(dateValue);
  if (Number.isNaN(dueDate.getTime())) return false;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDue = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const diffDays = Math.round((startOfDue.getTime() - startOfToday.getTime()) / 86400000);
  return diffDays >= 0 && diffDays <= 3;
}

function renderStats() {
  const activeCount = state.cases.filter((entry) => entry.status !== "Finished").length;
  activeCases.textContent = activeCount;
  totalClients.textContent = state.clients.length;
  upcomingDeadlines.textContent = state.deadlines.length;
  pendingDocs.textContent = state.documents;
}

function renderCases() {
  caseList.innerHTML = "";
  if (!state.cases.length) {
    caseList.innerHTML = `
      <li class="rounded-[22px] border border-dashed border-slate-200 bg-slate-50/80 px-5 py-6 text-sm text-slate-500">
        No cases available yet. Create a case to get started.
      </li>
    `;
    return;
  }

  state.cases.forEach((entry) => {
    const li = document.createElement("li");
    li.dataset.caseId = entry.id;
    li.className =
      "case-row-clickable grid gap-4 rounded-[22px] border border-slate-200 bg-white px-5 py-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg";
    const newestComments = (entry.comments || []).slice(0, 2);
    const requiredDocs = entry.requiredDocuments || [];
    const pendingCount = requiredDocs.filter((doc) => doc.status === "Pending").length;
    const uploadedCount = (entry.uploadedDocuments || []).length;
    const commentMarkup = newestComments.length
      ? `<div class="case-comments">${newestComments
          .map((comment) => `<p class="case-comment">${comment.createdAtLabel}: ${comment.text}</p>`)
          .join("")}</div>`
      : '<div class="case-comments"><p class="case-comment">No comments yet.</p></div>';
    const badgeClass = entry.status === "Finished" ? "badge success" : "badge";

    li.innerHTML = `
      <div class="min-w-0">
        ${entry.caseNumber ? `<p class="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">${entry.caseNumber}</p>` : ""}
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <strong class="block text-lg font-semibold text-slate-800">${entry.title}</strong>
            <p class="mt-2 text-sm text-slate-500">${entry.stage}</p>
          </div>
        </div>
        <div class="mt-4 flex flex-wrap gap-2 text-xs font-medium text-slate-500">
          <span class="rounded-full bg-slate-100 px-3 py-1">${entry.clientNames.join(", ") || "No client"}</span>
          <span class="rounded-full bg-slate-100 px-3 py-1">Required docs: ${requiredDocs.length}</span>
          <span class="rounded-full bg-slate-100 px-3 py-1">Pending: ${pendingCount}</span>
          <span class="rounded-full bg-slate-100 px-3 py-1">Uploaded files: ${uploadedCount}</span>
        </div>
        <div class="mt-4 rounded-2xl bg-slate-50 px-4 py-3">
          ${commentMarkup}
        </div>
      </div>
      <div class="case-actions flex items-start justify-end">
        <span class="${badgeClass} rounded-full px-4 py-2 text-xs font-semibold ${entry.status === "Finished" ? "bg-emerald-50 text-emerald-600" : "bg-indigo-50 text-indigo-600"}">${entry.status}</span>
      </div>
    `;
    caseList.appendChild(li);
  });
}

function renderDeadlines() {
  deadlineList.innerHTML = "";
  if (!state.deadlines.length) {
    deadlineList.innerHTML = `
      <li class="rounded-[22px] border border-dashed border-slate-200 bg-slate-50/80 px-5 py-6 text-sm text-slate-500">
        No upcoming deadlines right now.
      </li>
    `;
    return;
  }
  state.deadlines.forEach((entry) => {
    const li = document.createElement("li");
    li.className = "grid gap-4 rounded-[22px] border border-slate-200 bg-white px-5 py-5 shadow-sm";
    const isSoon = isDeadlineSoon(entry.date);
    li.innerHTML = `
      <div class="min-w-0">
        <strong class="flex items-center gap-3 text-base font-semibold text-slate-800">
          <span class="flex h-10 w-10 items-center justify-center rounded-2xl ${isSoon ? "bg-amber-100 text-amber-600" : "bg-indigo-100 text-indigo-600"}">
            ${isSoon ? "!" : "•"}
          </span>
          <span class="truncate">${entry.title}</span>
        </strong>
        <p class="mt-2 text-sm text-slate-500">Due: ${formatDate(entry.date)}</p>
      </div>
      <span class="justify-self-start rounded-full px-4 py-2 text-xs font-semibold ${isSoon ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"}">${isSoon ? "Due Soon" : "Upcoming"}</span>
    `;
    deadlineList.appendChild(li);
  });
}

function renderClients() {
  if (!clientList) return;

  clientList.innerHTML = "";

  if (!state.clients.length) {
    const li = document.createElement("li");
    li.className = "rounded-[22px] border border-dashed border-slate-200 bg-slate-50/80 px-5 py-6 text-sm text-slate-500";
    li.innerHTML = `
      <div>
        <strong>No clients yet.</strong>
        <p class="meta">Add a client from the case form to see it here.</p>
      </div>
    `;
    clientList.appendChild(li);
    return;
  }

  state.clients.slice(0, 5).forEach((client) => {
    const clientCaseCount = state.cases.filter((entry) => Number(entry.client_id) === Number(client.id)).length;
    const li = document.createElement("li");
    li.dataset.clientId = client.id;
    li.className =
      "case-row-clickable grid gap-4 rounded-[22px] border border-slate-200 bg-white px-5 py-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg";
    li.innerHTML = `
      <div class="client-row-main min-w-0">
        <strong class="block text-lg font-semibold text-slate-800">${client.name}</strong>
        <p class="mt-2 text-sm text-slate-500">
          ${client.address || "No address"} • ${client.email || "No email"} • ${client.phone || "No phone"}
        </p>
      </div>
      <span class="justify-self-start rounded-full bg-indigo-50 px-4 py-2 text-xs font-semibold text-indigo-600">${clientCaseCount} case(s)</span>
    `;
    clientList.appendChild(li);
  });
}

function render() {
  renderCasePatternAdminCard();
  renderLawyerCaseFilter();
  renderStats();
  renderCases();
  renderDeadlines();
  renderClients();
  renderQuickUploadCaseOptions();
}

async function reloadCases(filter = currentCaseFilter) {
  const session = getStoredSession();
  if (!session) return;
  currentCaseFilter = filter === "my-cases" ? "my-cases" : "all";

  const cases = await getCases(currentCaseFilter);
  const storedCasesById = new Map(readStoredCases().map((entry) => [String(entry.id), entry]));

  state.cases = cases.map((entry) => ({
    id: entry.id,
    title: entry.name,
    caseNumber: entry.case_number || "",
    stage: entry.short_description || "No description",
    client_id: entry.client_id,
    owner_id: entry.owner_id || null,
    clientNames: entry.client_name ? [entry.client_name] : [],
    status: entry.status || "open",
    can_edit: Boolean(entry.can_edit),
    is_owner: Boolean(entry.is_owner),
    is_assigned: Boolean(entry.is_assigned),
    deadline: entry.deadline || "",
    comments: storedCasesById.get(String(entry.id))?.comments || [],
    requiredDocuments: storedCasesById.get(String(entry.id))?.requiredDocuments || [],
    uploadedDocuments: normalizeUploadedDocuments(
      storedCasesById.get(String(entry.id))?.uploadedDocuments || []
    )
  }));

  state.deadlines = state.cases
    .filter((entry) => entry.deadline)
    .map((entry) => ({
      title: `${entry.title} deadline`,
      date: entry.deadline
    }));

  state.documents = state.cases.reduce(
    (total, entry) => total + normalizeUploadedDocuments(entry.uploadedDocuments).length,
    0
  );

  render();
}

function renderQuickUploadCaseOptions() {
  if (!assignUploadCaseSelect) return;
  assignUploadCaseSelect.innerHTML = "";
  const editableCases = state.cases.filter((entry) => canEditCase(getStoredSession(), entry));
  editableCases.forEach((entry) => {
    const option = document.createElement("option");
    option.value = entry.id;
    option.textContent = entry.title;
    assignUploadCaseSelect.appendChild(option);
  });
}

function openAssignUploadModal(files) {
  const { supportedFiles, unsupportedFiles } = splitUploadFiles(files);
  pendingQuickUploadFiles = supportedFiles;
  if (unsupportedFiles.length) {
    showToast(`Unsuccessful - ${unsupportedFiles.join(", ")}`, "error");
  }
  if (!pendingQuickUploadFiles.length) return;
  renderQuickUploadCaseOptions();
  if (!assignUploadCaseSelect.options.length) {
    quickUploadStatus.textContent = "You do not have upload access to any cases.";
    quickUploadStatus.className = "field-note error";
    pendingQuickUploadFiles = [];
    return;
  }
  assignUploadFileCount.textContent = `${pendingQuickUploadFiles.length} file(s) ready to upload.`;
  assignUploadModal.showModal();
}

// ==============================================================================
// UPDATED: Quick Upload now uses Real S3 + PostgreSQL Backend
// ==============================================================================
async function uploadPendingFilesToCase() {
  const selectedCaseId = assignUploadCaseSelect.value;
  if (!selectedCaseId) {
    quickUploadStatus.textContent = "Select a case first.";
    quickUploadStatus.className = "field-note error";
    return;
  }
  if (!pendingQuickUploadFiles.length) {
    quickUploadStatus.textContent = "No files selected.";
    quickUploadStatus.className = "field-note error";
    return;
  }

  quickUploadStatus.textContent = "Uploading to secure vault...";
  quickUploadStatus.className = "field-note";

  const caseIndex = state.cases.findIndex((entry) => Number(entry.id) === Number(selectedCaseId));
  if (caseIndex < 0) {
    quickUploadStatus.textContent = "Case not found.";
    quickUploadStatus.className = "field-note error";
    return;
  }

  const existingDocs = normalizeUploadedDocuments(state.cases[caseIndex].uploadedDocuments);
  const existingNames = new Set(existingDocs.map((file) => file.name));
  let successCount = 0;
  const failedUploads = [];

  for (const file of pendingQuickUploadFiles) {
    if (!existingNames.has(file.name)) {
      try {
        const uploadData = await uploadFile(file);
        const linkedDocument = await linkCaseDocument(selectedCaseId, {
          original_name: file.name,
          s3_key: uploadData.filePath,
          mime_type: file.type || "application/octet-stream",
          encryption_iv: uploadData.encryption_iv,
          encryption_tag: uploadData.encryption_tag
        });

        existingDocs.push({
          name: linkedDocument.original_name,
          previewUrl: "",
          mimeType: linkedDocument.mime_type || file.type || "",
          s3Key: linkedDocument.s3_key,
          encryptionIv: linkedDocument.encryption_iv || "",
          encryptionTag: linkedDocument.encryption_tag || "",
          uploadedAt: linkedDocument.uploaded_at || ""
        });
        existingNames.add(file.name);
        successCount++;
      } catch (error) {
        console.error(`Upload error for ${file.name}:`, error);
        failedUploads.push(file.name);
      }
    }
  }

  state.cases[caseIndex] = {
    ...state.cases[caseIndex],
    uploadedDocuments: existingDocs
  };
  state.documents += successCount;
  writeStoredCases(state.cases);
  render();

  quickUploadDocuments.value = "";
  quickUploadStatus.textContent = successCount > 0 ? `${successCount} file(s) uploaded.` : "No files were uploaded.";
  quickUploadStatus.className = successCount > 0 ? "field-note success" : "field-note error";
  if (successCount > 0) {
    showToast(`Successful (${successCount})`, "success");
  }
  if (failedUploads.length) {
    showToast(`Unsuccessful - ${failedUploads.join(", ")}`, "error");
  }
  pendingQuickUploadFiles = [];
  
  setTimeout(() => assignUploadModal.close(), 1500);
}

function clearClientForm() {
  clientFullName.value = "";
  clientAddress.value = "";
  clientEmail.value = "";
  clientPhone.value = "";
}

function clearCaseForm() {
  editingCaseId = null;
  modalTitle.textContent = "Add Case";
  if (caseNumberPreview) {
    caseNumberPreview.value = "Generated automatically after creation";
  }
  caseName.value = "";
  clientNames.value = "";
  caseStatus.value = "Active";
  caseDeadline.value = "";
  caseDescription.value = "";
  caseComment.value = "";
  selectedFiles = [];
  currentUploadedDocuments = [];
  newUploadNames = new Set();
  currentDocPlaceholders = [];
  selectedCaseAssigneeIds = new Set();
  caseDocuments.value = "";
  fileCount.textContent = "";
  docPlaceholderName.value = "";
  docPlaceholderStatus.value = "Pending";
  renderDocPlaceholderList();
  renderUploadedFileBoxes();
  renderCaseTeamSelection();
  clientStatus.textContent = "";
  clientStatus.className = "field-note";
  clientForm.classList.add("hidden");
  dragDepth = 0;
  screenDropOverlay.classList.add("hidden");
  clearClientForm();
}

function renderDocPlaceholderList() {
  docPlaceholderList.innerHTML = "";
  if (!currentDocPlaceholders.length) {
    const li = document.createElement("li");
    li.className = "rounded-[22px] border border-dashed border-slate-200 bg-slate-50/80 px-5 py-6 text-sm text-slate-500";
    li.innerHTML = "<p>No required document placeholders added.</p>";
    docPlaceholderList.appendChild(li);
    return;
  }

  currentDocPlaceholders.forEach((entry, index) => {
    const li = document.createElement("li");
    li.className =
      "doc-placeholder-item grid gap-4 rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm xl:grid-cols-[minmax(0,1fr)_minmax(260px,360px)_auto] xl:items-start";

    const label = document.createElement("div");
    label.innerHTML = `
      <p class="text-lg font-semibold text-slate-800">${entry.name}</p>
      <p class="mt-2 text-sm text-slate-500">${entry.status}</p>
    `;

    const dropField = document.createElement("div");
    dropField.className =
      "doc-drop-field min-h-[120px] rounded-[20px] border border-dashed border-slate-300 bg-slate-50 p-4 transition";
    dropField.dataset.docDropId = entry.id;

    const attachedFiles = Array.isArray(entry.attachedFiles) ? entry.attachedFiles : [];

    if (attachedFiles.length) {
      const attachedList = document.createElement("div");
      attachedList.className = "doc-drop-file-list flex flex-col gap-3";

      attachedFiles.forEach((attachedFile) => {
        const linkedFile = currentUploadedDocuments.find((file) => file.name === attachedFile.original_name);
        const fileCard = document.createElement("div");
        fileCard.className = "flex items-center gap-3 rounded-2xl bg-white px-3 py-3 shadow-sm";
        fileCard.innerHTML = `
          <span class="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-xs font-semibold text-indigo-600">${getFileExtension(linkedFile?.name || attachedFile.original_name)}</span>
          <div class="min-w-0">
            <p class="truncate text-sm font-medium text-slate-700">${linkedFile?.name || attachedFile.original_name}</p>
            <p class="text-xs text-slate-400">${attachedFile.mime_type || "Attached file"}</p>
          </div>
        `;
        attachedList.appendChild(fileCard);
      });

      dropField.appendChild(attachedList);
    } else {
      dropField.innerHTML = `
        <div class="flex h-full min-h-[88px] items-center justify-center text-center text-sm text-slate-400">
          Drop an uploaded file here
        </div>
      `;
    }

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className =
      "btn-ghost btn-small h-fit rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50";
    removeBtn.dataset.docRemove = String(index);
    removeBtn.textContent = "Remove";

    li.appendChild(label);
    li.appendChild(dropField);
    li.appendChild(removeBtn);
    docPlaceholderList.appendChild(li);
  });
}

function normalizeUploadedDocuments(documents) {
  return (documents || []).map((item) =>
    typeof item === "string"
      ? { name: item, previewUrl: "", mimeType: "", s3Key: "", encryptionIv: "", encryptionTag: "", uploadedAt: "" }
      : {
          name: item.name,
          previewUrl: item.previewUrl || "",
          mimeType: item.mimeType || "",
          s3Key: item.s3Key || "",
          encryptionIv: item.encryptionIv || "",
          encryptionTag: item.encryptionTag || "",
          uploadedAt: item.uploadedAt || ""
        }
  );
}

function getFileExtension(name) {
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex === -1) return "FILE";
  return name.slice(dotIndex + 1).toUpperCase();
}

function isImageFile(file) {
  return file.mimeType && file.mimeType.startsWith("image/");
}

function renderUploadedFileBoxes() {
  uploadedFileBoxes.innerHTML = "";
  if (!currentUploadedDocuments.length) return;
  currentUploadedDocuments.forEach((file) => {
    const box = document.createElement("button");
    box.type = "button";
    box.className =
      "uploaded-file-box flex min-w-[180px] items-center gap-3 rounded-[22px] border border-slate-200 bg-white px-4 py-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg";
    box.draggable = true;
    box.dataset.fileName = file.name;

    const thumb = document.createElement("div");
    thumb.className = "uploaded-file-thumb";

    if (isImageFile(file) && file.previewUrl) {
      const image = document.createElement("img");
      image.className = "uploaded-file-thumb-image";
      image.src = file.previewUrl;
      image.alt = file.name;
      thumb.appendChild(image);
    } else {
      const typeLabel = document.createElement("span");
      typeLabel.className = "uploaded-file-thumb-label";
      typeLabel.textContent = getFileExtension(file.name);
      thumb.appendChild(typeLabel);
    }

    const nameWrap = document.createElement("div");
    nameWrap.className = "min-w-0";
    nameWrap.innerHTML = `
      <span class="uploaded-file-name block truncate text-sm font-semibold text-slate-700">${file.name}</span>
      <span class="mt-1 block text-xs text-slate-400">${file.mimeType || "Pending upload"}</span>
    `;

    box.appendChild(thumb);
    box.appendChild(nameWrap);
    uploadedFileBoxes.appendChild(box);
  });
}

function updateClientStatus() {
  const names = parseClientNames(clientNames.value);
  if (!names.length) {
    clientStatus.textContent = "";
    clientStatus.className = "field-note";
    return;
  }

  const missingClients = names.filter((name) => !findClientByName(name));
  if (!missingClients.length) {
    clientStatus.textContent = "All clients found.";
    clientStatus.className = "field-note success";
  } else {
    clientStatus.textContent = `Missing client(s): ${missingClients.join(", ")}. Click Add Client.`;
    clientStatus.className = "field-note error";
  }
}

function updateSelectedFiles(files) {
  selectedFiles = Array.from(files || []);
  if (!selectedFiles.length) {
    fileCount.textContent = currentUploadedDocuments.length
      ? `${currentUploadedDocuments.length} uploaded file(s) in this case.`
      : "No files selected.";
    return;
  }

  // We only add them to the visual UI here. They will be uploaded when the user clicks 'Save Case'
  const existingNames = new Set(currentUploadedDocuments.map((file) => file.name));
  selectedFiles.forEach((file) => {
    if (!existingNames.has(file.name)) {
      currentUploadedDocuments.push({
        name: file.name,
        previewUrl: URL.createObjectURL(file), // Temporary visual preview
        mimeType: file.type || "",
        uploadedAt: Date.now()
      });
      newUploadNames.add(file.name);
      existingNames.add(file.name);
    }
  });
  fileCount.textContent = `${currentUploadedDocuments.length} uploaded file(s) ready to save.`;
  renderUploadedFileBoxes();
}

async function openEditCase(caseId) {
  const entry = state.cases.find((item) => item.id === caseId);
  if (!entry) return;

  editingCaseId = caseId;
  modalTitle.textContent = "Edit Case";
  if (caseNumberPreview) {
    caseNumberPreview.value = entry.caseNumber || "Generated automatically after creation";
  }
  caseName.value = entry.title;
  clientNames.value = entry.clientNames.join(", ");
  caseStatus.value = entry.status || "Active";
  caseDescription.value = entry.stage || "";
  caseComment.value = "";
  caseDeadline.value = entry.deadline || "";
  selectedFiles = [];
  currentUploadedDocuments = normalizeUploadedDocuments(entry.uploadedDocuments);
  newUploadNames = new Set();
  currentDocPlaceholders = (entry.requiredDocuments || []).map((doc) => ({ ...doc }));
  selectedCaseAssigneeIds = new Set();
  caseDocuments.value = "";
  fileCount.textContent = currentUploadedDocuments.length
    ? `${currentUploadedDocuments.length} uploaded file(s) in this case.`
    : "";
  docPlaceholderName.value = "";
  docPlaceholderStatus.value = "Pending";

  if (canManageCaseTeam(entry)) {
    try {
      const assignments = await getCaseAssignments(caseId);
      selectedCaseAssigneeIds = new Set(assignments.map((user) => String(user.id)));
    } catch (error) {
      console.error("Failed to load case assignments for edit:", error);
    }
  }

  renderDocPlaceholderList();
  renderUploadedFileBoxes();
  renderCaseTeamSelection(entry);
  updateClientStatus();
  quickAddModal.showModal();
}

newCaseMainBtn.addEventListener("click", () => {
  if (!canCreateCases(getStoredSession())) {
    window.alert("Your role cannot create new cases.");
    return;
  }
  if (!isCasePatternConfigured()) {
    window.alert("Admin must configure the case number pattern first.");
    return;
  }
  clearCaseForm();
  quickAddModal.showModal();
});

cancelBtn.addEventListener("click", () => {
  dragDepth = 0;
  screenDropOverlay.classList.add("hidden");
  quickAddModal.close();
});

if (closeModalBtn) {
  closeModalBtn.addEventListener("click", () => {
    dragDepth = 0;
    screenDropOverlay.classList.add("hidden");
    quickAddModal.close();
  });
}

quickAddModal.addEventListener("click", (event) => {
  if (event.target === quickAddModal) {
    dragDepth = 0;
    screenDropOverlay.classList.add("hidden");
    quickAddModal.close();
  }
});

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    if (!window.confirm("Are you sure you want to log out?")) return;
    clearStoredSession();
    window.location.href = "login.html";
  });
}

if (calendarBtn) {
  calendarBtn.addEventListener("click", () => {
    window.location.href = "calendar.html";
  });
}

if (viewAllCasesBtn) {
  viewAllCasesBtn.addEventListener("click", () => {
    window.location.href = "cases.html";
  });
}

if (viewAllClientsBtn) {
  viewAllClientsBtn.addEventListener("click", () => {
    window.location.href = "clients.html";
  });
}

if (lawyerCaseFilter) {
  lawyerCaseFilter.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;

    const nextFilter = button.dataset.filter === "my-cases" ? "my-cases" : "all";
    if (nextFilter === currentCaseFilter) return;
    console.log("Frontend sending filter:", nextFilter);

    try {
      await reloadCases(nextFilter);
    } catch (error) {
      console.error("Failed to reload cases with lawyer filter:", error);
      showToast(error.message || "Failed to apply case filter.", "error");
    }
  });
}

if (quickUploadDropZone) {
  quickUploadDropZone.addEventListener("click", () => quickUploadDocuments.click());
  quickUploadDropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    quickUploadDropZone.classList.add("drag-active");
  });
  quickUploadDropZone.addEventListener("dragleave", () => {
    quickUploadDropZone.classList.remove("drag-active");
  });
  quickUploadDropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    quickUploadDropZone.classList.remove("drag-active");
    openAssignUploadModal(event.dataTransfer.files);
  });
  quickUploadDocuments.addEventListener("change", () => {
    openAssignUploadModal(quickUploadDocuments.files);
  });
}

if (cancelAssignUploadBtn) {
  cancelAssignUploadBtn.addEventListener("click", () => {
    pendingQuickUploadFiles = [];
    assignUploadModal.close();
  });
}

if (confirmAssignUploadBtn) {
  confirmAssignUploadBtn.addEventListener("click", uploadPendingFilesToCase);
}

if (toggleDarkModeBtn) {
  toggleDarkModeBtn.addEventListener("click", () => {
    const nextTheme = document.body.classList.contains("dark-mode") ? "light" : "dark";
    localStorage.setItem(THEME_KEY, nextTheme);
    applyTheme(nextTheme);
  });
}

clientNames.addEventListener("input", updateClientStatus);

caseList.addEventListener("click", (event) => {
  const row = event.target.closest("[data-case-id]");
  if (row) {
    window.location.href = `case-detail.html?id=${encodeURIComponent(row.dataset.caseId)}`;
  }
});

if (clientList) {
  clientList.addEventListener("click", (event) => {
    const row = event.target.closest("[data-client-id]");
    if (row) {
      window.location.href = `client-detail.html?id=${encodeURIComponent(row.dataset.clientId)}`;
    }
  });
}

function canManageCaseTeam(entry = null) {
  const session = getStoredSession();
  if (!session) return false;
  if (session.role === "admin") return true;
  if (session.role !== "lawyer") return false;
  return !entry || Boolean(entry.is_owner);
}

function renderCaseTeamSelection(entry = null) {
  if (!caseTeamSection || !caseTeamList) return;

  const canManageTeam = canManageCaseTeam(entry);
  caseTeamSection.classList.toggle("hidden", !canManageTeam);
  if (!canManageTeam) {
    caseTeamList.innerHTML = "";
    return;
  }

  const session = getStoredSession();
  const fixedOwnerId = entry?.owner_id ? String(entry.owner_id) : session?.id ? String(session.id) : "";
  const eligibleUsers = assignableCaseUsers.filter(
    (user) =>
      (user.role === "lawyer" || user.role === "assistant") &&
      String(user.id) !== fixedOwnerId
  );
  const fixedOwner = assignableCaseUsers.find((user) => String(user.id) === fixedOwnerId);
  if (!eligibleUsers.length) {
    caseTeamList.innerHTML = "";
  }

  const fixedMarkup = fixedOwner
    ? `
      <div class="assignment-selection-item assignment-selection-item-fixed flex items-center gap-3 rounded-[22px] border border-dashed border-indigo-200 bg-indigo-50/70 px-4 py-4">
        <input type="checkbox" checked disabled class="h-4 w-4 rounded border-slate-300 text-indigo-600" />
        <span class="text-sm font-medium text-slate-700">${fixedOwner.full_name || fixedOwner.username} (${fixedOwner.role}) • Case owner</span>
      </div>
    `
    : "";

  const selectableMarkup = eligibleUsers
    .map(
      (user) => `
        <label class="assignment-selection-item flex items-center gap-3 rounded-[22px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
          <input
            type="checkbox"
            data-case-assignee
            value="${user.id}"
            ${selectedCaseAssigneeIds.has(String(user.id)) ? "checked" : ""}
            class="h-4 w-4 rounded border-slate-300 text-indigo-600"
          />
          <span class="text-sm font-medium text-slate-700">${user.full_name || user.username} (${user.role})</span>
        </label>
      `
    )
    .join("");

  caseTeamList.innerHTML =
    fixedMarkup +
    (selectableMarkup || '<p class="field-note">No additional assistants or lawyers available.</p>');
}

if (caseTeamList) {
  caseTeamList.addEventListener("change", (event) => {
    const checkbox = event.target.closest("[data-case-assignee]");
    if (!checkbox) return;
    if (checkbox.checked) {
      selectedCaseAssigneeIds.add(String(checkbox.value));
    } else {
      selectedCaseAssigneeIds.delete(String(checkbox.value));
    }
  });
}

showClientFormBtn.addEventListener("click", () => {
  clientForm.classList.toggle("hidden");
});

addDocPlaceholderBtn.addEventListener("click", () => {
  const name = docPlaceholderName.value.trim();
  const status = docPlaceholderStatus.value;
  if (!name) {
    docPlaceholderName.focus();
    return;
  }

  currentDocPlaceholders.push({
    id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    status,
    attachedFiles: []
  });
  docPlaceholderName.value = "";
  docPlaceholderStatus.value = "Pending";
  renderDocPlaceholderList();
});

docPlaceholderList.addEventListener("click", (event) => {
  const removeBtn = event.target.closest("[data-doc-remove]");
  if (!removeBtn) return;
  const index = Number(removeBtn.dataset.docRemove);
  if (Number.isNaN(index)) return;
  currentDocPlaceholders.splice(index, 1);
  renderDocPlaceholderList();
});

uploadedFileBoxes.addEventListener("dragstart", (event) => {
  const fileBox = event.target.closest(".uploaded-file-box");
  if (!fileBox) return;
  event.dataTransfer.setData("text/plain", fileBox.dataset.fileName || "");
});

docPlaceholderList.addEventListener("dragover", (event) => {
  const dropField = event.target.closest("[data-doc-drop-id]");
  if (!dropField) return;
  event.preventDefault();
  dropField.classList.add("drag-active");
});

docPlaceholderList.addEventListener("dragleave", (event) => {
  const dropField = event.target.closest("[data-doc-drop-id]");
  if (!dropField) return;
  dropField.classList.remove("drag-active");
});

docPlaceholderList.addEventListener("drop", (event) => {
  const dropField = event.target.closest("[data-doc-drop-id]");
  if (!dropField) return;
  event.preventDefault();
  dropField.classList.remove("drag-active");
  const fileName = event.dataTransfer.getData("text/plain");
  if (!fileName) return;
  const linkedFile = currentUploadedDocuments.find((file) => file.name === fileName);
  if (!linkedFile) return;

  const placeholderId = dropField.dataset.docDropId;
  const placeholder = currentDocPlaceholders.find((item) => item.id === placeholderId);
  if (!placeholder) return;

  placeholder.attachedFiles = placeholder.attachedFiles || [];
  if (!placeholder.attachedFiles.some((entry) => entry.original_name === linkedFile.name)) {
    placeholder.attachedFiles.push({
      original_name: linkedFile.name,
      s3_key: linkedFile.s3Key || "",
      mime_type: linkedFile.mimeType || "",
      encryption_iv: linkedFile.encryptionIv || "",
      encryption_tag: linkedFile.encryptionTag || ""
    });
  }
  placeholder.status = placeholder.attachedFiles.length ? "Uploaded" : "Pending";
  renderDocPlaceholderList();
});

saveClientBtn.addEventListener("click", async () => {
  const full_name = clientFullName.value.trim();
  const address = clientAddress.value.trim();
  const email = clientEmail.value.trim();
  const phone = clientPhone.value.trim();

  if (!full_name || !address) {
    clientStatus.textContent = "Client name and address are required.";
    clientStatus.className = "field-note error";
    return;
  }

  if (findClientByName(full_name)) {
    clientStatus.textContent = "Client already exists.";
    clientStatus.className = "field-note error";
    return;
  }

  try {
    const createdClient = await createClient({
      full_name,
      address,
      email,
      phone,
      zip_code: "",
      city: "",
      state: ""
    });

    state.clients.push({
      id: createdClient.id,
      name: createdClient.full_name,
      address: createdClient.address || "",
      email: createdClient.email || "",
      phone: createdClient.phone || ""
    });

    const currentNames = parseClientNames(clientNames.value);
    currentNames.push(createdClient.full_name);
    clientNames.value = currentNames.join(", ");

    clearClientForm();
    clientForm.classList.add("hidden");
    clientStatus.textContent = "Client added successfully.";
    clientStatus.className = "field-note success";
    renderStats();
  } catch (error) {
    clientStatus.textContent = error.message || "Failed to create client.";
    clientStatus.className = "field-note error";
  }
});

dropZone.addEventListener("click", () => caseDocuments.click());
caseDocuments.addEventListener("change", () => updateSelectedFiles(caseDocuments.files));

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("drag-active");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("drag-active");
});

dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("drag-active");
  updateSelectedFiles(event.dataTransfer.files);
});

document.addEventListener("dragenter", (event) => {
  event.preventDefault();
  if (!quickAddModal.open) return;
  dragDepth += 1;
  screenDropOverlay.classList.remove("hidden");
});

document.addEventListener("dragover", (event) => {
  if (!quickAddModal.open) return;
  event.preventDefault();
});

document.addEventListener("dragleave", () => {
  if (!quickAddModal.open) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) {
    screenDropOverlay.classList.add("hidden");
  }
});

document.addEventListener("drop", (event) => {
  if (!quickAddModal.open) return;
  event.preventDefault();
  dragDepth = 0;
  screenDropOverlay.classList.add("hidden");
  updateSelectedFiles(event.dataTransfer.files);
});

// ==============================================================================
// UPDATED: Save Case now also uploads selected files to S3/Postgres
// ==============================================================================
saveBtn.addEventListener("click", async () => {
  const name = caseName.value.trim();
  const inputClientNames = parseClientNames(clientNames.value);
  const deadline = caseDeadline.value || null;
  const short_description = caseDescription.value.trim();
  const status = caseStatus.value || "open";

  if (!name) {
    caseName.focus();
    return;
  }

  if (!inputClientNames.length) {
    clientStatus.textContent = "Please add at least one existing client.";
    clientStatus.className = "field-note error";
    clientNames.focus();
    return;
  }

  const existingClient = findClientByName(inputClientNames[0]);
  if (!existingClient) {
    clientStatus.textContent = `Missing client: ${inputClientNames[0]}. Please add it first.`;
    clientStatus.className = "field-note error";
    clientNames.focus();
    return;
  }

  try {
    if (!editingCaseId && !isCasePatternConfigured()) {
      window.alert("Admin must configure the case number pattern first.");
      return;
    }

    let targetCaseId;
    let createdCaseNumber = "";
    const uploadedDocumentMap = new Map();

    if (editingCaseId) {
      const updated = await updateCase(editingCaseId, {
        name,
        client_id: existingClient.id,
        status,
        deadline,
        short_description
      });
      targetCaseId = updated.id;
      
      const caseIndex = state.cases.findIndex((entry) => Number(entry.id) === Number(editingCaseId));
      if (caseIndex >= 0) {
        state.cases[caseIndex] = {
          ...state.cases[caseIndex],
          id: updated.id,
          title: updated.name,
          caseNumber: updated.case_number || state.cases[caseIndex].caseNumber || "",
          stage: updated.short_description || "No description",
          client_id: updated.client_id,
          clientNames: [existingClient.name],
          status: updated.status || "open",
          deadline: updated.deadline || ""
        };
      }
    } else {
      const created = await createCase({
          name,
          client_id: existingClient.id,
          status,
          deadline,
          short_description
      });
      targetCaseId = created.id;
      createdCaseNumber = created.case_number || "";
      
      state.cases.unshift({
        id: created.id,
        title: created.name,
        caseNumber: created.case_number || "",
        stage: created.short_description || "No description",
        client_id: created.client_id,
        clientNames: [existingClient.name],
        status: created.status || "open",
        deadline: created.deadline || "",
        comments: [],
        requiredDocuments: [],
        uploadedDocuments: []
      });
    }

    // NEW: Upload any files that were dropped into the modal
    if (selectedFiles.length > 0) {
      const uploadedDocuments = [];
      const failedUploads = [];
      for (const file of selectedFiles) {
        try {
          const uploadData = await uploadFile(file);
          const linkedDocument = await linkCaseDocument(targetCaseId, {
            original_name: file.name,
            s3_key: uploadData.filePath,
            mime_type: file.type || "application/octet-stream",
            encryption_iv: uploadData.encryption_iv,
            encryption_tag: uploadData.encryption_tag
          });

          uploadedDocuments.push({
            name: linkedDocument.original_name,
            previewUrl: "",
            mimeType: linkedDocument.mime_type || file.type || "",
            s3Key: linkedDocument.s3_key,
            encryptionIv: linkedDocument.encryption_iv || "",
            encryptionTag: linkedDocument.encryption_tag || "",
            uploadedAt: linkedDocument.uploaded_at || ""
          });
          uploadedDocumentMap.set(linkedDocument.original_name, {
            s3_key: linkedDocument.s3_key,
            mime_type: linkedDocument.mime_type || file.type || "",
            encryption_iv: linkedDocument.encryption_iv || "",
            encryption_tag: linkedDocument.encryption_tag || ""
          });
        } catch (error) {
          console.error(`Error uploading ${file.name} with new case:`, error);
          failedUploads.push(file.name);
        }
      }

      const targetCaseIndex = state.cases.findIndex((entry) => Number(entry.id) === Number(targetCaseId));
      if (targetCaseIndex >= 0 && uploadedDocuments.length) {
        state.cases[targetCaseIndex] = {
          ...state.cases[targetCaseIndex],
          uploadedDocuments: [
            ...(state.cases[targetCaseIndex].uploadedDocuments || []),
            ...uploadedDocuments
          ]
        };
      }

      if (failedUploads.length) {
        window.alert(`Some files could not be uploaded: ${failedUploads.join(", ")}`);
      }
    }

    if (currentDocPlaceholders.length > 0) {
      const createdPlaceholders = await createCasePlaceholders(
        targetCaseId,
        currentDocPlaceholders.map((placeholder) => ({
          name: placeholder.name,
          status:
            (placeholder.attachedFiles || []).some((file) => uploadedDocumentMap.get(file.original_name))
              ? "Uploaded"
              : placeholder.status || "Pending",
          attached_files: (placeholder.attachedFiles || [])
            .map((file) => {
              const uploadedDocument = uploadedDocumentMap.get(file.original_name);
              if (!uploadedDocument?.s3_key) return null;
              return {
                original_name: file.original_name,
                s3_key: uploadedDocument.s3_key,
                mime_type: uploadedDocument.mime_type || file.mime_type || "",
                encryption_iv: uploadedDocument.encryption_iv || "",
                encryption_tag: uploadedDocument.encryption_tag || ""
              };
            })
            .filter(Boolean)
        }))
      );

      const targetCaseIndex = state.cases.findIndex((entry) => Number(entry.id) === Number(targetCaseId));
      if (targetCaseIndex >= 0) {
        state.cases[targetCaseIndex] = {
          ...state.cases[targetCaseIndex],
          requiredDocuments: createdPlaceholders.map((placeholder, index) => ({
            id: placeholder.id,
            name: placeholder.name,
            status: placeholder.status || "Pending",
            attachedFiles: Array.isArray(placeholder.attached_files) ? placeholder.attached_files : []
          }))
        };
      }
    }

    if (selectedCaseAssigneeIds.size > 0) {
      const selectedIds = Array.from(selectedCaseAssigneeIds);
      await Promise.all(
        selectedIds.map((userId) => assignUserToCase(targetCaseId, userId))
      );
    }

    state.deadlines = state.cases
      .filter((entry) => entry.deadline)
      .map((entry) => ({
        title: `${entry.title} deadline`,
        date: entry.deadline
      }));
      
    dragDepth = 0;
    screenDropOverlay.classList.add("hidden");
    quickAddModal.close();
    writeStoredCases(state.cases);
    render();
    if (!editingCaseId && createdCaseNumber) {
      window.alert(`Case created successfully.\nInternal Case Number: ${createdCaseNumber}`);
    }
  } catch (error) {
    console.error(error);
    alert(error.message || "Failed to save case.");
  }
});

if (saveCasePatternBtn) {
  saveCasePatternBtn.addEventListener("click", async () => {
    const session = getStoredSession();
    if (session?.role !== "admin") return;

    const pattern = String(casePatternInput?.value || "").trim();
    if (!pattern) {
      casePatternStatus.textContent = "Pattern is required.";
      casePatternStatus.className = "mt-3 text-sm text-red-700";
      casePatternInput.focus();
      return;
    }

    try {
      saveCasePatternBtn.disabled = true;
      casePatternStatus.textContent = "Saving case number pattern...";
      casePatternStatus.className = "mt-3 text-sm text-slate-500";

      const response = await updateCasePatternSetting(pattern);
      state.casePatternSetting = response.setting;
      applyCaseCreationLock(session);
      renderCasePatternAdminCard(session);
      showToast("Case number pattern saved.", "success");
    } catch (error) {
      console.error("Failed to save case number pattern:", error);
      casePatternStatus.textContent = error.message || "Failed to save case number pattern.";
      casePatternStatus.className = "mt-3 text-sm text-red-700";
    } finally {
      saveCasePatternBtn.disabled = false;
    }
  });
}

renderDocPlaceholderList();
renderUploadedFileBoxes();
render();
