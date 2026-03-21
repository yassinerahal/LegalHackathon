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
const calendarBtn = document.getElementById("calendarBtn");
const viewAllCasesBtn = document.getElementById("viewAllCasesBtn");

const quickAddModal = document.getElementById("quickAddModal");
const modalTitle = document.getElementById("modalTitle");
const newItemBtn = document.getElementById("newItemBtn");
const logoutBtn = document.getElementById("logoutBtn");
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
const SESSION_KEY = "nextact_current_user";
const DEADLINES_KEY = "nextact_deadlines";
const CASES_KEY = "nextact_cases";

function requireSession() {
  const sessionRaw = localStorage.getItem(SESSION_KEY);
  if (!sessionRaw) {
    window.location.href = "login.html";
  }
}

function loadDeadlines() {
  const raw = localStorage.getItem(DEADLINES_KEY);
  if (!raw) return DEFAULT_DEADLINES.map((entry) => ({ ...entry }));
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) {
      return DEFAULT_DEADLINES.map((entry) => ({ ...entry }));
    }
    return parsed;
  } catch (error) {
    return DEFAULT_DEADLINES.map((entry) => ({ ...entry }));
  }
}

function saveDeadlines() {
  localStorage.setItem(DEADLINES_KEY, JSON.stringify(state.deadlines));
}

function loadCases() {
  const raw = localStorage.getItem(CASES_KEY);
  if (!raw) {
    return INITIAL_CASES.map((entry, index) => ({
      id: `case-${Date.now()}-${index}`,
      title: entry.title,
      stage: entry.stage,
      clientNames: [entry.clientName],
      status: "Active",
      comments: [],
      requiredDocuments: [],
      uploadedDocuments: []
    }));
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) return parsed;
    return INITIAL_CASES.map((entry, index) => ({
      id: `case-${Date.now()}-${index}`,
      title: entry.title,
      stage: entry.stage,
      clientNames: [entry.clientName],
      status: "Active",
      comments: [],
      requiredDocuments: [],
      uploadedDocuments: []
    }));
  } catch (error) {
    return INITIAL_CASES.map((entry, index) => ({
      id: `case-${Date.now()}-${index}`,
      title: entry.title,
      stage: entry.stage,
      clientNames: [entry.clientName],
      status: "Active",
      comments: [],
      requiredDocuments: [],
      uploadedDocuments: []
    }));
  }
}

function saveCases() {
  localStorage.setItem(CASES_KEY, JSON.stringify(state.cases));
}

requireSession();
state.cases = loadCases();
state.deadlines = loadDeadlines();
saveCases();
saveDeadlines();

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
  const date = new Date(`${dateValue}T00:00:00`);
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

function render() {
  renderStats();
  renderCases();
  renderDeadlines();
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

newItemBtn.addEventListener("click", () => {
  clearCaseForm();
  quickAddModal.showModal();
});

cancelBtn.addEventListener("click", () => {
  dragDepth = 0;
  screenDropOverlay.classList.add("hidden");
  quickAddModal.close();
});

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
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
clientNames.addEventListener("input", updateClientStatus);

caseList.addEventListener("click", (event) => {
  const row = event.target.closest("[data-case-id]");
  if (row) {
    window.location.href = `case-detail.html?id=${encodeURIComponent(row.dataset.caseId)}`;
  }
});

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

saveClientBtn.addEventListener("click", () => {
  const name = clientFullName.value.trim();
  const address = clientAddress.value.trim();
  const email = clientEmail.value.trim();
  const phone = clientPhone.value.trim();

  if (!name || !address) {
    clientStatus.textContent = "Client name and address are required.";
    clientStatus.className = "field-note error";
    return;
  }

  if (findClientByName(name)) {
    clientStatus.textContent = "Client already exists.";
    clientStatus.className = "field-note error";
    return;
  }

  state.clients.push({ name, address, email, phone });
  const currentNames = parseClientNames(clientNames.value);
  currentNames.push(name);
  clientNames.value = currentNames.join(", ");
  clearClientForm();
  clientForm.classList.add("hidden");
  clientStatus.textContent = "Client added successfully.";
  clientStatus.className = "field-note success";
  renderStats();
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

saveBtn.addEventListener("click", () => {
  const title = caseName.value.trim();
  const inputClientNames = parseClientNames(clientNames.value);
  const deadline = caseDeadline.value;
  const description = caseDescription.value.trim();
  const status = caseStatus.value;
  const commentText = caseComment.value.trim();
  const resolvedClientNames = [];
  if (!title) {
    caseName.focus();
    return;
  }

  if (!inputClientNames.length) {
    clientStatus.textContent = "Please add at least one existing client.";
    clientStatus.className = "field-note error";
    clientNames.focus();
    return;
  }

  for (const name of inputClientNames) {
    const existingClient = findClientByName(name);
    if (!existingClient) {
      clientStatus.textContent = `Missing client: ${name}. Please add it first.`;
      clientStatus.className = "field-note error";
      clientNames.focus();
      return;
    }
    resolvedClientNames.push(existingClient.name);
  }

  const newComment = commentText
    ? {
        text: commentText,
        createdAt: Date.now(),
        createdAtLabel: new Date().toLocaleString()
      }
    : null;

  if (editingCaseId) {
    const caseIndex = state.cases.findIndex((entry) => entry.id === editingCaseId);
    if (caseIndex >= 0) {
      const existingComments = state.cases[caseIndex].comments || [];
      state.cases[caseIndex] = {
        ...state.cases[caseIndex],
        title,
        stage: description || "New case",
        deadline,
        clientNames: resolvedClientNames,
        status,
        comments: newComment ? [newComment, ...existingComments] : existingComments,
        requiredDocuments: currentDocPlaceholders.map((doc) => ({ ...doc })),
        uploadedDocuments: currentUploadedDocuments.map((file) => ({ ...file }))
      };
    }
  } else {
    state.cases.unshift({
      id: `case-${Date.now()}`,
      title,
      stage: description || "New case",
      deadline,
      clientNames: resolvedClientNames,
      status,
      comments: newComment ? [newComment] : [],
      requiredDocuments: currentDocPlaceholders.map((doc) => ({ ...doc })),
      uploadedDocuments: currentUploadedDocuments.map((file) => ({ ...file }))
    });

    if (deadline) {
      state.deadlines.unshift({
        title: `${title} deadline`,
        date: deadline
      });
      saveDeadlines();
    }
  }

  saveCases();

  state.documents += newUploadNames.size;

  dragDepth = 0;
  screenDropOverlay.classList.add("hidden");
  quickAddModal.close();
  render();
});

renderDocPlaceholderList();
renderUploadedFileBoxes();
render();
