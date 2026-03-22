const INITIAL_CASES = [
  { title: "Al-Hassan vs Vertex Ltd", stage: "Discovery", clientName: "Maya Al-Hassan" },
  { title: "Estate Planning - M. Karim", stage: "Drafting", clientName: "Mina Karim" },
  { title: "Labor Dispute - Noor Group", stage: "Hearing Prep", clientName: "Noor Group" }
];

const DEFAULT_DEADLINES = [
  { title: "File motion for Vertex case", date: "2026-03-23" },
  { title: "Client review meeting", date: "2026-03-25" },
  { title: "Submit compliance checklist", date: "2026-03-27" }
];

const state = {
  cases: INITIAL_CASES.map((entry, index) => ({
    id: `case-${Date.now()}-${index}`,
    title: entry.title,
    stage: entry.stage,
    clientNames: [entry.clientName],
    status: "Active",
    comments: [],
    requiredDocuments: [],
    uploadedDocuments: []
  })),
  deadlines: [],
  clients: [
    { name: "Maya Al-Hassan", address: "City Center 10", email: "", phone: "" },
    { name: "Mina Karim", address: "Palm Street 8", email: "", phone: "" },
    { name: "Noor Group", address: "Business Bay 21", email: "", phone: "" }
  ],
  documents: 7
};

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

let selectedFiles = [];
let currentUploadedDocuments = [];
let newUploadNames = new Set();
let dragDepth = 0;
let editingCaseId = null;
let currentDocPlaceholders = [];
let pendingQuickUploadFiles = [];
const SESSION_KEY = "nextact_current_user";
const THEME_KEY = "nextact_theme";

function requireSession() {
  const sessionRaw = localStorage.getItem(SESSION_KEY);
  if (!sessionRaw) {
    window.location.href = "login.html";
  }
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

async function initDashboard() {
  requireSession();
  applyTheme(readTheme());
  renderLoggedInUser();

  try {
    const [cases, clients] = await Promise.all([getCases(), getClients()]);

    state.cases = cases.map((entry) => ({
      id: entry.id,
      title: entry.name,
      stage: entry.short_description || "No description",
      client_id: entry.client_id,
      clientNames: entry.client_name ? [entry.client_name] : [],
      status: entry.status || "open",
      deadline: entry.deadline || "",
      comments: [],
      requiredDocuments: [],
      uploadedDocuments: []
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
          .map(
            (comment) =>
              `<p class="case-comment">${comment.createdAtLabel}: ${comment.text}</p>`
          )
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
}

function renderQuickUploadCaseOptions() {
  if (!assignUploadCaseSelect) return;
  assignUploadCaseSelect.innerHTML = "";
  state.cases.forEach((entry) => {
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
  assignUploadFileCount.textContent = `${pendingQuickUploadFiles.length} file(s) ready to upload.`;
  assignUploadModal.showModal();
}

function uploadPendingFilesToCase() {
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

  const caseIndex = state.cases.findIndex((entry) => entry.id === selectedCaseId);
  if (caseIndex < 0) {
    quickUploadStatus.textContent = "Case not found.";
    quickUploadStatus.className = "field-note error";
    return;
  }

  const existingDocs = normalizeUploadedDocuments(state.cases[caseIndex].uploadedDocuments);
  const existingNames = new Set(existingDocs.map((file) => file.name));
  pendingQuickUploadFiles.forEach((file) => {
    if (!existingNames.has(file.name)) {
      existingDocs.push({
        name: file.name,
        previewUrl: URL.createObjectURL(file),
        mimeType: file.type || ""
      });
      existingNames.add(file.name);
    }
  });

  state.cases[caseIndex] = {
    ...state.cases[caseIndex],
    uploadedDocuments: existingDocs
  };
  state.documents += pendingQuickUploadFiles.length;
  render();
  quickUploadDocuments.value = "";
  quickUploadStatus.textContent = `${pendingQuickUploadFiles.length} file(s) uploaded successfully.`;
  quickUploadStatus.className = "field-note success";
  pendingQuickUploadFiles = [];
  assignUploadModal.close();
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
  caseDocuments.value = "";
  fileCount.textContent = "";
  docPlaceholderName.value = "";
  docPlaceholderStatus.value = "Pending";
  renderDocPlaceholderList();
  renderUploadedFileBoxes();
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

    if (entry.uploadedFileName) {
      const linkedFile = currentUploadedDocuments.find((file) => file.name === entry.uploadedFileName);
      if (linkedFile && isImageFile(linkedFile) && linkedFile.previewUrl) {
        const image = document.createElement("img");
        image.className = "doc-drop-thumb-image";
        image.src = linkedFile.previewUrl;
        image.alt = linkedFile.name;
        dropField.appendChild(image);
      } else {
        const typeLabel = document.createElement("span");
        typeLabel.className = "doc-drop-thumb-label";
        typeLabel.textContent = getFileExtension(entry.uploadedFileName);
        dropField.appendChild(typeLabel);
      }

      const text = document.createElement("span");
      text.textContent = `Linked: ${entry.uploadedFileName}`;
      dropField.appendChild(text);
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
      ? { name: item, previewUrl: "", mimeType: "" }
      : {
          name: item.name,
          previewUrl: item.previewUrl || "",
          mimeType: item.mimeType || ""
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

  const existingNames = new Set(currentUploadedDocuments.map((file) => file.name));
  selectedFiles.forEach((file) => {
    if (!existingNames.has(file.name)) {
      currentUploadedDocuments.push({
        name: file.name,
        previewUrl: URL.createObjectURL(file),
        mimeType: file.type || "",
        uploadedAt: Date.now()

      });
      newUploadNames.add(file.name);
      existingNames.add(file.name);
    }
  });

  fileCount.textContent = `${currentUploadedDocuments.length} uploaded file(s) in this case.`;
  renderUploadedFileBoxes();
}

function openEditCase(caseId) {
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
  caseDocuments.value = "";
  fileCount.textContent = currentUploadedDocuments.length
    ? `${currentUploadedDocuments.length} uploaded file(s) in this case.`
    : "";
  docPlaceholderName.value = "";
  docPlaceholderStatus.value = "Pending";
  renderDocPlaceholderList();
  renderUploadedFileBoxes();
  updateClientStatus();
  quickAddModal.showModal();
}

newCaseMainBtn.addEventListener("click", () => {
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
    localStorage.removeItem(SESSION_KEY);
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
    status
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
  if (!currentUploadedDocuments.some((file) => file.name === fileName)) return;

  const placeholderId = dropField.dataset.docDropId;
  const placeholder = currentDocPlaceholders.find((item) => item.id === placeholderId);
  if (!placeholder) return;

  placeholder.status = "Uploaded";
  placeholder.uploadedFileName = fileName;
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
    if (editingCaseId) {
      const updated = await updateCase(editingCaseId, {
        name,
        client_id: existingClient.id,
        status,
        deadline,
        short_description
      });

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

    state.deadlines = state.cases
      .filter((entry) => entry.deadline)
      .map((entry) => ({
        title: `${entry.title} deadline`,
        date: entry.deadline
      }));

    dragDepth = 0;
    screenDropOverlay.classList.add("hidden");
    quickAddModal.close();
    render();
  } catch (error) {
    console.error(error);
    alert(error.message || "Failed to save case.");
  }
});

renderDocPlaceholderList();
renderUploadedFileBoxes();
render();
