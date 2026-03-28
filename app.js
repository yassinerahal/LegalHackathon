const INITIAL_CASES = [];
const DEFAULT_DEADLINES = [];

const state = {
  cases: [],
  deadlines: [],
  clients: [],
  documents: 0,
  pendingUsers: [],
  allUsers: []
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
const adminMainCard = document.getElementById("adminMainCard");
const adminPendingCount = document.getElementById("adminPendingCount");
const openAdminPanelBtn = document.getElementById("openAdminPanelBtn");
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

const quickAddModal = document.getElementById("quickAddModal");
const modalTitle = document.getElementById("modalTitle");
const closeModalBtn = document.getElementById("closeModalBtn");
const newItemBtn = document.getElementById("newItemBtn");
const logoutBtn = document.getElementById("logoutBtn");
const billingBtn = document.getElementById("billingBtn");
const cancelBtn = document.getElementById("cancelBtn");
const saveBtn = document.getElementById("saveBtn");
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
const SESSION_KEY = "nextact_current_user";
const CASES_KEY = "nextact_cases";
const THEME_KEY = "nextact_theme";

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
  } catch (error) {
    loggedInUserName.textContent = "";
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

async function initDashboard() {
  const session = requireSession();
  if (!session) return;
  applyTheme(readTheme());
  renderLoggedInUser();
  if (newCaseMainBtn) {
    newCaseMainBtn.hidden = !canCreateCases(session);
  }
  if (adminMainCard) {
    adminMainCard.classList.toggle("hidden", session.role !== "admin");
  }

  try {
    const requests = [getCases(), getClients()];
    if (session.role === "admin" || session.role === "lawyer") {
      requests.push(getAssignableUsers());
    }
    if (session.role === "admin") {
      requests.push(getPendingUsers(), getAllUsers());
    }

    const responses = await Promise.all(requests);
    const cases = responses.shift() || [];
    const clients = responses.shift() || [];
    const assignableUsers =
      session.role === "admin" || session.role === "lawyer" ? responses.shift() || [] : [];
    const pendingUsers = session.role === "admin" ? responses.shift() || [] : [];
    const allUsers = session.role === "admin" ? responses.shift() || [] : [];
    const storedCasesById = new Map(readStoredCases().map((entry) => [String(entry.id), entry]));
    const caseDocumentsById = new Map();
    const documentResults = await Promise.allSettled(
      cases.map(async (entry) => ({
        caseId: String(entry.id),
        documents: await getCaseDocuments(entry.id)
      }))
    );
    documentResults.forEach((result) => {
      if (result.status === "fulfilled") {
        caseDocumentsById.set(result.value.caseId, result.value.documents);
      }
    });

    state.cases = cases.map((entry) => ({
      id: entry.id,
      title: entry.name,
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
      uploadedDocuments: (caseDocumentsById.get(String(entry.id)) || []).map((document) => ({
        name: document.original_name,
        previewUrl: "",
        mimeType: document.mime_type || "",
        s3Key: document.s3_key,
        encryptionIv: document.encryption_iv || "",
        encryptionTag: document.encryption_tag || "",
        uploadedAt: document.uploaded_at || ""
      }))
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
    state.pendingUsers = Array.isArray(pendingUsers) ? pendingUsers : [];
    state.allUsers = Array.isArray(allUsers) ? allUsers : [];
    assignableCaseUsers = Array.isArray(assignableUsers) ? assignableUsers : [];
    writeStoredCases(state.cases);
    render();
  } catch (error) {
    console.error(error);
  }
}

initDashboard();

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

function renderStats() {
  const activeCount = state.cases.filter((entry) => entry.status !== "Finished").length;
  activeCases.textContent = activeCount;
  totalClients.textContent = state.clients.length;
  upcomingDeadlines.textContent = state.deadlines.length;
  pendingDocs.textContent = state.documents;
}

function renderCases() {
  caseList.innerHTML = "";
  state.cases.forEach((entry) => {
    const li = document.createElement("li");
    li.dataset.caseId = entry.id;
    li.classList.add("case-row-clickable");
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
      <div>
        <strong>${entry.title}</strong>
        <p class="meta">${entry.stage} • ${entry.clientNames.join(", ")}</p>
        <p class="case-doc-status">Required docs: ${requiredDocs.length} • Pending: ${pendingCount} • Uploaded files: ${uploadedCount}</p>
        ${commentMarkup}
      </div>
      <div class="case-actions">
        <span class="${badgeClass}">${entry.status}</span>
      </div>
    `;
    caseList.appendChild(li);
  });
}

function renderDeadlines() {
  deadlineList.innerHTML = "";
  state.deadlines.forEach((entry) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <div>
        <strong>${entry.title}</strong>
        <p class="meta">Due: ${formatDate(entry.date)}</p>
      </div>
      <span class="badge success">Upcoming</span>
    `;
    deadlineList.appendChild(li);
  });
}

function renderClients() {
  if (!clientList) return;

  clientList.innerHTML = "";

  if (!state.clients.length) {
    const li = document.createElement("li");
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
    li.classList.add("case-row-clickable");
    li.innerHTML = `
      <div>
        <strong>${client.name}</strong>
        <p class="meta">
          ${client.address || "No address"} • ${client.email || "No email"} • ${client.phone || "No phone"}
        </p>
      </div>
      <span class="badge">${clientCaseCount} case(s)</span>
    `;
    clientList.appendChild(li);
  });
}

function render() {
  renderStats();
  renderCases();
  renderDeadlines();
  renderClients();
  renderQuickUploadCaseOptions();
  renderAdminMainCard();
  renderAdminPendingPanel();
}

function renderAdminMainCard() {
  const session = getStoredSession();
  if (!adminMainCard || session?.role !== "admin") return;
  if (adminPendingCount) {
    adminPendingCount.textContent = String(state.pendingUsers.length);
  }
}

function renderAdminPendingPanel() {
  const session = getStoredSession();
  const existingPanel = document.getElementById("adminPendingPanel");
  if (!dashboardMain || session?.role !== "admin") {
    if (existingPanel) existingPanel.remove();
    return;
  }

  const panel = existingPanel || document.createElement("section");
  panel.id = "adminPendingPanel";
  panel.className = "panel";

  const listMarkup = state.allUsers.length
    ? state.allUsers
        .map(
          (user) => `
            <li class="admin-pending-item" data-user-id="${user.id}">
              <div>
                <strong>${user.full_name || user.username}</strong>
                <p class="meta">${user.email} • ${user.is_approved ? "Approved" : "Pending"}</p>
              </div>
              <div class="admin-pending-actions">
                <select data-user-role>
                  <option value="lawyer" ${user.role === "lawyer" ? "selected" : ""}>Lawyer</option>
                  <option value="assistant" ${user.role === "assistant" ? "selected" : ""}>Assistant</option>
                  <option value="client" ${user.role === "client" ? "selected" : ""}>Client</option>
                  <option value="admin" ${user.role === "admin" ? "selected" : ""}>Admin</option>
                </select>
                <button type="button" class="btn-primary" data-save-user-role>
                  ${user.is_approved ? "Save Role" : "Approve"}
                </button>
              </div>
            </li>
          `
        )
        .join("")
    : '<li><p class="field-note">No registered users found.</p></li>';

  panel.innerHTML = `
    <div class="panel-head">
      <h3>User Management</h3>
    </div>
    <ul class="list">${listMarkup}</ul>
  `;

  if (!existingPanel) {
    dashboardMain.appendChild(panel);
  }
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
  pendingQuickUploadFiles = Array.from(files || []);
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

async function handleSaveUserRoleClick(button) {
  const item = button.closest("[data-user-id]");
  if (!item) return;

  const userId = item.dataset.userId;
  const roleSelect = item.querySelector("[data-user-role]");
  const selectedRole = roleSelect?.value || "lawyer";

  try {
    button.disabled = true;
    const result = await updateUserRole(userId, selectedRole);
    state.allUsers = state.allUsers.map((user) =>
      String(user.id) === String(userId) ? result.user : user
    );
    state.pendingUsers = state.allUsers.filter((user) => !user.is_approved || user.role === "pending");
    renderAdminMainCard();
    renderAdminPendingPanel();
  } catch (error) {
    console.error("Failed to update user role:", error);
    window.alert(error.message || "Failed to update user role.");
    button.disabled = false;
  }
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
  quickUploadStatus.textContent =
    successCount > 0
      ? `${successCount} file(s) uploaded successfully.${failedUploads.length ? ` Failed: ${failedUploads.join(", ")}` : ""}`
      : "No files were uploaded.";
  quickUploadStatus.className = successCount > 0 ? "field-note success" : "field-note error";
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
    li.className = "doc-placeholder-item";
    li.innerHTML = "<p>No required document placeholders added.</p>";
    docPlaceholderList.appendChild(li);
    return;
  }

  currentDocPlaceholders.forEach((entry, index) => {
    const li = document.createElement("li");
    li.className = "doc-placeholder-item";

    const label = document.createElement("p");
    label.textContent = `${entry.name} • ${entry.status}`;

    const dropField = document.createElement("div");
    dropField.className = "doc-drop-field";
    dropField.dataset.docDropId = entry.id;

    const attachedFiles = Array.isArray(entry.attachedFiles) ? entry.attachedFiles : [];

    if (attachedFiles.length) {
      const attachedList = document.createElement("div");
      attachedList.className = "doc-drop-file-list";

      attachedFiles.forEach((attachedFile) => {
        const linkedFile = currentUploadedDocuments.find((file) => file.name === attachedFile.original_name);
        const fileChip = document.createElement("span");
        fileChip.className = "doc-drop-thumb-label";
        fileChip.textContent = linkedFile?.name || attachedFile.original_name;
        attachedList.appendChild(fileChip);
      });

      dropField.appendChild(attachedList);
    } else {
      dropField.textContent = "Drop an uploaded file here";
    }

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn-ghost btn-small";
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
    box.className = "uploaded-file-box";
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

    const name = document.createElement("span");
    name.className = "uploaded-file-name";
    name.textContent = file.name;

    box.appendChild(thumb);
    box.appendChild(name);
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
      <div class="assignment-selection-item assignment-selection-item-fixed">
        <input type="checkbox" checked disabled />
        <span>${fixedOwner.full_name || fixedOwner.username} (${fixedOwner.role}) • Case owner</span>
      </div>
    `
    : "";

  const selectableMarkup = eligibleUsers
    .map(
      (user) => `
        <label class="assignment-selection-item">
          <input
            type="checkbox"
            data-case-assignee
            value="${user.id}"
            ${selectedCaseAssigneeIds.has(String(user.id)) ? "checked" : ""}
          />
          <span>${user.full_name || user.username} (${user.role})</span>
        </label>
      `
    )
    .join("");

  caseTeamList.innerHTML =
    fixedMarkup +
    (selectableMarkup || '<p class="field-note">No additional assistants or lawyers available.</p>');
}

if (dashboardMain) {
  dashboardMain.addEventListener("click", (event) => {
    const saveRoleBtn = event.target.closest("[data-save-user-role]");
    if (saveRoleBtn) {
      handleSaveUserRoleClick(saveRoleBtn);
      return;
    }

    const openAdminBtn = event.target.closest("#openAdminPanelBtn");
    if (!openAdminBtn) return;

    const adminPanel = document.getElementById("adminPendingPanel");
    if (adminPanel) {
      adminPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
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
    let targetCaseId;
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
      
      state.cases.unshift({
        id: created.id,
        title: created.name,
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
  } catch (error) {
    console.error(error);
    alert(error.message || "Failed to save case.");
  }
});

renderDocPlaceholderList();
renderUploadedFileBoxes();
render();
