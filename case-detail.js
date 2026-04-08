const SESSION_KEY = "nextact_current_user";
const CASES_KEY = "nextact_cases";
const THEME_KEY = "nextact_theme";

const caseTitle = document.getElementById("caseTitle");
const caseStatusBadge = document.getElementById("caseStatusBadge");
const caseMeta = document.getElementById("caseMeta");
const caseDescription = document.getElementById("caseDescription");
const caseDeadline = document.getElementById("caseDeadline");
const detailDropZone = document.getElementById("detailDropZone");
const detailCaseDocuments = document.getElementById("detailCaseDocuments");
const detailFileCount = document.getElementById("detailFileCount");
const uploadedDocumentsGrid = document.getElementById("uploadedDocumentsGrid");
const requiredDocsList = document.getElementById("requiredDocsList");
const detailDocPlaceholderName = document.getElementById("detailDocPlaceholderName");
const detailDocPlaceholderStatus = document.getElementById("detailDocPlaceholderStatus");
const detailAddDocPlaceholderBtn = document.getElementById("detailAddDocPlaceholderBtn");
const commentsList = document.getElementById("commentsList");
const caseAssignmentsPanel = document.getElementById("caseAssignmentsPanel");
const caseAssigneeSelect = document.getElementById("caseAssigneeSelect");
const assignCaseUserBtn = document.getElementById("assignCaseUserBtn");
const caseAssignmentsStatus = document.getElementById("caseAssignmentsStatus");
const caseAssignmentsList = document.getElementById("caseAssignmentsList");
const goDashboardBtn = document.getElementById("goDashboardBtn");
const loggedInUserName = document.getElementById("loggedInUserName");
const toggleDarkModeBtn = document.getElementById("toggleDarkModeBtn");
const billingBtn = document.getElementById("billingBtn");
const logoutBtn = document.getElementById("logoutBtn");
const deleteCaseBtn = document.getElementById("deleteCaseBtn");
const editCaseBtn = document.getElementById("editCaseBtn");
const editCaseModal = document.getElementById("editCaseModal");
const editCaseNumber = document.getElementById("editCaseNumber");
const editCaseName = document.getElementById("editCaseName");
const editClientNames = document.getElementById("editClientNames");
const editCaseStatus = document.getElementById("editCaseStatus");
const editCaseDeadline = document.getElementById("editCaseDeadline");
const editCaseDescription = document.getElementById("editCaseDescription");
const editCaseComment = document.getElementById("editCaseComment");
const editCaseTeamSection = document.getElementById("editCaseTeamSection");
const editCaseTeamList = document.getElementById("editCaseTeamList");
const finishCaseBtn = document.getElementById("finishCaseBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const saveEditBtn = document.getElementById("saveEditBtn");
const placeholderHistoryModal = document.getElementById("placeholderHistoryModal");
const placeholderHistoryTitle = document.getElementById("placeholderHistoryTitle");
const placeholderHistorySubtitle = document.getElementById("placeholderHistorySubtitle");
const placeholderHistoryTimeline = document.getElementById("placeholderHistoryTimeline");
const closePlaceholderHistoryBtn = document.getElementById("closePlaceholderHistoryBtn");
const fileContextMenu = document.getElementById("fileContextMenu");
const ctxDownloadBtn = document.getElementById("ctxDownloadBtn");
const ctxCopyBtn = document.getElementById("ctxCopyBtn");
const ctxRemoveBtn = document.getElementById("ctxRemoveBtn");

let currentCaseId = null;
let contextMenuFile = null;
let availableAssignees = [];
let assignedUsers = [];
let selectedEditAssigneeIds = new Set();
let detailToastTimeouts = new WeakMap();
let activeHistoryPlaceholderId = null;

function requireSession() {
  return requireStaffSession();
}

function ensureDetailUploadInputHints() {
  if (detailCaseDocuments) {
    detailCaseDocuments.setAttribute("accept", SUPPORTED_UPLOAD_ACCEPT);
  }
}

function getDetailToastRegion() {
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

function showDetailToast(message, variant = "success") {
  if (!message) return;
  const region = getDetailToastRegion();
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

  detailToastTimeouts.set(toast, timeoutId);
  toast.addEventListener("click", () => {
    window.clearTimeout(detailToastTimeouts.get(toast));
    toast.classList.remove("visible");
    window.setTimeout(() => toast.remove(), 220);
  });
}

function splitDetailUploadFiles(files) {
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

function canManageCaseAssignments(session = getStoredSession(), entry = null) {
  if (!session || !entry) return false;
  return session.role === "admin" || Boolean(entry.is_owner);
}

function canModifyCaseMetadata(session = getStoredSession(), entry = null) {
  if (!session || !entry) return false;
  if (session.role === "admin") return true;
  if (session.role === "lawyer") return Boolean(entry.can_edit || entry.is_owner || entry.is_assigned);
  return false;
}

function canDeleteCurrentCase(session = getStoredSession(), entry = null) {
  if (!session || !entry) return false;
  return session.role === "admin" || Boolean(entry.is_owner);
}

function setEditModalReadOnlyState(isReadOnly) {
  editCaseName.readOnly = isReadOnly;
  editClientNames.readOnly = isReadOnly;
  editCaseStatus.disabled = isReadOnly;
  editCaseDeadline.readOnly = isReadOnly;
  editCaseDescription.readOnly = isReadOnly;
  editCaseComment.readOnly = isReadOnly;
  saveEditBtn.hidden = isReadOnly;
  saveEditBtn.disabled = isReadOnly;
  finishCaseBtn.hidden = isReadOnly;
  finishCaseBtn.disabled = isReadOnly;
}

function readCases() {
  const raw = localStorage.getItem(CASES_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function writeCases(cases) {
  localStorage.setItem(
    CASES_KEY,
    JSON.stringify(
      cases.map((entry) => ({
        ...entry,
        requiredDocuments: (entry.requiredDocuments || []).map((document) => ({
          id: document.id,
          name: document.name,
          status: document.status || "Pending",
          versions: Array.isArray(document.versions)
            ? document.versions
            : Array.isArray(document.attachedFiles)
              ? document.attachedFiles
              : [],
          attachedFiles: Array.isArray(document.attachedFiles)
            ? document.attachedFiles
            : Array.isArray(document.versions)
              ? document.versions
              : []
        })),
        uploadedDocuments: (entry.uploadedDocuments || []).map((document) => ({
          name: document.name,
          mimeType: document.mimeType || "",
          s3Key: document.s3Key || "",
          encryptionIv: document.encryptionIv || "",
          encryptionTag: document.encryptionTag || "",
          uploadedAt: document.uploadedAt || ""
        }))
      }))
    )
  );
}

function getCurrentCaseAndIndex() {
  const cases = readCases();
  const index = cases.findIndex((entry) => String(entry.id) === String(currentCaseId));
  return { cases, index };
}

function mergeCaseIntoLocal(entry) {
  const cases = readCases();
  const index = cases.findIndex((item) => String(item.id) === String(entry.id));
  const existing = index >= 0 ? cases[index] : {};
  const hasEntryComments = Array.isArray(entry.comments);
  const hasEntryRequiredDocuments = Array.isArray(entry.requiredDocuments);
  const hasEntryUploadedDocuments = Array.isArray(entry.uploadedDocuments);
  const mergedEntry = {
    ...existing,
    ...entry,
    comments: hasEntryComments ? entry.comments : existing.comments || [],
    requiredDocuments: hasEntryRequiredDocuments ? entry.requiredDocuments : existing.requiredDocuments || [],
    uploadedDocuments: hasEntryUploadedDocuments ? entry.uploadedDocuments : existing.uploadedDocuments || []
  };

  if (index >= 0) {
    cases[index] = mergedEntry;
  } else {
    cases.unshift(mergedEntry);
  }

  writeCases(cases);
  return mergedEntry;
}

function hideContextMenu() {
  fileContextMenu.classList.add("hidden");
  contextMenuFile = null;
}

function removeFileFromCase(fileName) {
  const { cases, index } = getCurrentCaseAndIndex();
  if (index < 0) return;
  const uploadedDocuments = normalizeUploadedDocuments(cases[index].uploadedDocuments).filter(
    (file) => file.name !== fileName
  );
  const requiredDocuments = (cases[index].requiredDocuments || []).map((doc) => {
    const versions = getPlaceholderVersions(doc).filter((entry) => entry.original_name !== fileName);
    return {
      ...doc,
      status: versions.length ? "Uploaded" : "Pending",
      versions,
      attachedFiles: versions
    };
  });
  cases[index] = {
    ...cases[index],
    uploadedDocuments,
    requiredDocuments
  };
  writeCases(cases);
  renderCaseDetails(cases[index]);
}

async function removePlaceholderFromCase(placeholderId) {
  const { cases, index } = getCurrentCaseAndIndex();
  if (index < 0) return;

  const placeholder = (cases[index].requiredDocuments || []).find(
    (entry) => String(entry.id) === String(placeholderId)
  );
  if (!placeholder) return;

  const confirmed = window.confirm(
    "Remove this placeholder and delete all files attached to it from the database and storage?"
  );
  if (!confirmed) return;

  try {
    const result = await deleteCasePlaceholder(currentCaseId, placeholderId);
    const deletedKeys = new Set((result.deleted_s3_keys || []).map((key) => String(key)));

    cases[index] = {
      ...cases[index],
      requiredDocuments: (cases[index].requiredDocuments || []).filter(
        (entry) => String(entry.id) !== String(placeholderId)
      ),
      uploadedDocuments: normalizeUploadedDocuments(cases[index].uploadedDocuments).filter(
        (document) => !deletedKeys.has(String(document.s3Key || ""))
      )
    };

    writeCases(cases);
    renderCaseDetails(cases[index]);
    showDetailToast("Placeholder and attached files deleted.", "success");
  } catch (error) {
    console.error("Failed to delete placeholder:", error);
    window.alert(error.message || "Failed to delete placeholder.");
  }
}

function parseClientNames(value) {
  const seen = new Set();
  return value
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
    .filter((name) => {
      const key = name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function getCaseIdFromQuery() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

function getFileExtension(name) {
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex === -1) return "FILE";
  return name.slice(dotIndex + 1).toUpperCase();
}

function getShortDisplayFileName(name, maxBaseLength = 10) {
  const safeName = String(name || "").trim();
  if (!safeName) return "file";

  const dotIndex = safeName.lastIndexOf(".");
  const hasExtension = dotIndex > 0 && dotIndex < safeName.length - 1;
  const extension = hasExtension ? safeName.slice(dotIndex) : "";
  const baseName = hasExtension ? safeName.slice(0, dotIndex) : safeName;

  if (baseName.length <= maxBaseLength) {
    return `${baseName}${extension}`;
  }

  return `${baseName.slice(0, maxBaseLength)}...${extension}`;
}

function getFileIcon(filename) {
  const extension = getFileExtension(filename).toLowerCase();
  if (extension === "pdf") return "📄";
  if (extension === "doc" || extension === "docx") return "📝";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(extension)) return "🖼️";
  return "📁";
}

function getDocumentDownloadUrl(documentMeta) {
  const s3Key = documentMeta?.s3Key || documentMeta?.s3_key || "";
  const originalName = documentMeta?.name || documentMeta?.original_name || "file";
  return getApiUrl(
    `/documents/${encodeURIComponent(s3Key)}/download?name=${encodeURIComponent(originalName)}`
  );
}

async function triggerDocumentDownload(documentMeta) {
  const downloadUrl = getDocumentDownloadUrl(documentMeta);
  if (!documentMeta?.s3Key && !documentMeta?.s3_key) return;
  try {
    const response = await fetch(downloadUrl, {
      headers: buildAuthHeaders()
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        clearStoredSession();
        window.location.href = "login.html";
        return;
      }
      throw new Error("Failed to download document.");
    }

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = documentMeta?.name || documentMeta?.original_name || "file";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error("Failed to download document:", error);
    window.alert(error.message || "Failed to download document.");
  }
}

function isImageFile(file) {
  return file.mimeType && file.mimeType.startsWith("image/");
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

function getPlaceholderVersions(placeholder) {
  if (Array.isArray(placeholder?.versions)) {
    return placeholder.versions;
  }
  if (Array.isArray(placeholder?.attachedFiles)) {
    return placeholder.attachedFiles;
  }
  return [];
}

function normalizePlaceholder(placeholder) {
  const versions = Array.isArray(placeholder?.versions)
    ? placeholder.versions
    : Array.isArray(placeholder?.attached_files)
      ? placeholder.attached_files
      : Array.isArray(placeholder?.attachedFiles)
        ? placeholder.attachedFiles
        : [];

  return {
    id: placeholder.id,
    name: placeholder.name,
    status: placeholder.status || (versions.length ? "Uploaded" : "Pending"),
    versions,
    attachedFiles: versions
  };
}

function formatHistoryDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.toLocaleString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  })} Uhr`;
}

function getHistoryVersionLabel(index, total) {
  if (index === 0) return "Original Version";
  if (index === total - 1) return "Aktuelle Version";
  return `Revision ${index}`;
}

function renderPlaceholderHistoryTimeline(versions) {
  if (!placeholderHistoryTimeline) return;
  if (!versions.length) {
    placeholderHistoryTimeline.innerHTML =
      '<div class="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">No version history available for this placeholder.</div>';
    return;
  }

  placeholderHistoryTimeline.innerHTML = "";

  const list = document.createElement("div");
  list.className = "relative ml-4 border-l-2 border-slate-200 pl-8";

  versions.forEach((version, index) => {
    const isLatest = index === versions.length - 1;
    const item = document.createElement("article");
    item.className = "relative mb-6 last:mb-0";

    const node = document.createElement("span");
    node.className = isLatest
      ? "absolute -left-[41px] top-6 flex h-6 w-6 items-center justify-center rounded-full border-4 border-indigo-100 bg-indigo-600 shadow-md"
      : "absolute -left-[39px] top-6 flex h-5 w-5 items-center justify-center rounded-full border-4 border-white bg-slate-300 shadow-sm";

    const card = document.createElement("div");
    card.className = isLatest
      ? "rounded-[24px] border border-indigo-200 bg-indigo-50/50 p-5 shadow-md shadow-indigo-100/60"
      : "rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm";

    card.innerHTML = `
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="min-w-0">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] ${isLatest ? "text-indigo-600" : "text-slate-400"}">${getHistoryVersionLabel(index, versions.length)}</p>
          <h4 class="mt-2 break-words text-lg font-semibold text-slate-800">${version.original_name || "Unnamed file"}</h4>
          <p class="mt-2 text-sm text-slate-500">${formatHistoryDateTime(version.uploaded_at)}</p>
        </div>
        <button type="button" class="history-download-btn rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50" data-history-s3-key="${version.s3_key || ""}" data-history-file-name="${version.original_name || "file"}">Download</button>
      </div>
    `;

    item.appendChild(node);
    item.appendChild(card);
    list.appendChild(item);
  });

  placeholderHistoryTimeline.appendChild(list);
}

async function openPlaceholderHistory(placeholderId) {
  if (!placeholderId) return;

  const { cases, index } = getCurrentCaseAndIndex();
  const placeholder = index >= 0
    ? (cases[index].requiredDocuments || []).find((entry) => String(entry.id) === String(placeholderId))
    : null;

  try {
    activeHistoryPlaceholderId = placeholderId;
    if (placeholderHistoryTitle) {
      placeholderHistoryTitle.textContent = placeholder?.name
        ? `History: ${placeholder.name}`
        : "Version History";
    }
    if (placeholderHistorySubtitle) {
      placeholderHistorySubtitle.textContent = "Chronological overview of all uploaded versions for this placeholder.";
    }
    renderPlaceholderHistoryTimeline([]);
    if (!placeholderHistoryModal.open) {
      placeholderHistoryModal.showModal();
    }

    const history = await getPlaceholderHistory(placeholderId);
    const normalizedHistory = Array.isArray(history) ? history : [];
    if (placeholderHistorySubtitle) {
      placeholderHistorySubtitle.textContent = `${normalizedHistory.length} version(s), oldest first.`;
    }
    renderPlaceholderHistoryTimeline(normalizedHistory);
  } catch (error) {
    console.error("Failed to load placeholder history:", error);
    if (placeholderHistoryTimeline) {
      placeholderHistoryTimeline.innerHTML = `
        <div class="rounded-[22px] border border-red-200 bg-red-50 px-5 py-8 text-sm text-red-700">
          ${error.message || "Failed to load placeholder history."}
        </div>
      `;
    }
  }
}

function renderCaseAssignments(entry) {
  const canManageAssignments = canManageCaseAssignments(getStoredSession(), entry);
  caseAssignmentsPanel.hidden = !canManageAssignments;
  if (!canManageAssignments) {
    return;
  }

  const eligibleUsers = availableAssignees.filter((user) => user.role === "lawyer" || user.role === "assistant");
  const assignedIds = new Set(assignedUsers.map((user) => String(user.id)));

  caseAssigneeSelect.innerHTML = "";
  eligibleUsers
    .filter((user) => !assignedIds.has(String(user.id)))
    .forEach((user) => {
      const option = document.createElement("option");
      option.value = user.id;
      option.textContent = `${user.full_name || user.username} (${user.role})`;
      caseAssigneeSelect.appendChild(option);
    });

  assignCaseUserBtn.disabled = !caseAssigneeSelect.options.length;
  caseAssignmentsList.innerHTML = "";

  if (!assignedUsers.length) {
    caseAssignmentsList.innerHTML =
      '<li class="rounded-[22px] border border-dashed border-slate-200 bg-slate-50/80 px-5 py-6 text-sm text-slate-500"><p class="field-note">No additional users assigned yet.</p></li>';
    return;
  }

  assignedUsers.forEach((user) => {
    const li = document.createElement("li");
    li.className = "grid gap-4 rounded-[22px] border border-slate-200 bg-white px-5 py-5 shadow-sm";
    li.innerHTML = `
      <div>
        <strong class="block text-lg font-semibold text-slate-800">${user.full_name || user.username}</strong>
        <p class="mt-2 text-sm text-slate-500">${user.email} • ${user.role}</p>
      </div>
    `;
    caseAssignmentsList.appendChild(li);
  });
}

function renderEditCaseTeamSelection(entry) {
  if (!editCaseTeamSection || !editCaseTeamList) return;

  const canManageAssignments = canManageCaseAssignments(getStoredSession(), entry);
  editCaseTeamSection.classList.toggle("hidden", !canManageAssignments);
  if (!canManageAssignments) {
    editCaseTeamList.innerHTML = "";
    return;
  }

  const fixedOwnerId = entry?.owner_id ? String(entry.owner_id) : "";
  const fixedOwner = availableAssignees.find((user) => String(user.id) === fixedOwnerId);
  const eligibleUsers = availableAssignees.filter(
    (user) =>
      (user.role === "lawyer" || user.role === "assistant") &&
      String(user.id) !== fixedOwnerId
  );

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
            data-edit-case-assignee
            value="${user.id}"
            ${selectedEditAssigneeIds.has(String(user.id)) ? "checked" : ""}
            class="h-4 w-4 rounded border-slate-300 text-indigo-600"
          />
          <span class="text-sm font-medium text-slate-700">${user.full_name || user.username} (${user.role})</span>
        </label>
      `
    )
    .join("");

  editCaseTeamList.innerHTML =
    fixedMarkup +
    (selectableMarkup || '<p class="field-note">No additional assistants or lawyers available.</p>');
}

async function saveUploadedFilesToCase(files) {
  if (!currentCaseId || !files.length) return;
  const { supportedFiles, unsupportedFiles } = splitDetailUploadFiles(files);
  if (unsupportedFiles.length) {
    showDetailToast(`Unsuccessful - ${unsupportedFiles.join(", ")}`, "error");
  }
  if (!supportedFiles.length) return;
  const cases = readCases();
  const caseIndex = cases.findIndex((entry) => entry.id === currentCaseId);
  if (caseIndex < 0) return;

  const currentDocs = normalizeUploadedDocuments(cases[caseIndex].uploadedDocuments);
  const existing = new Set(currentDocs.map((file) => file.name));
  let successCount = 0;
  const failedUploads = [];

  for (const file of supportedFiles) {
    if (!existing.has(file.name)) {
      try {
        const uploadData = await uploadFile(file);
        const linkedDocument = await linkCaseDocument(currentCaseId, {
          original_name: file.name,
          s3_key: uploadData.filePath,
          mime_type: file.type || "application/octet-stream",
          encryption_iv: uploadData.encryption_iv,
          encryption_tag: uploadData.encryption_tag
        });

        currentDocs.push({
          name: linkedDocument.original_name,
          previewUrl: "",
          mimeType: linkedDocument.mime_type || file.type || "",
          s3Key: linkedDocument.s3_key,
          encryptionIv: linkedDocument.encryption_iv || "",
          encryptionTag: linkedDocument.encryption_tag || "",
          uploadedAt: linkedDocument.uploaded_at || ""
        });
        existing.add(file.name);
        successCount++;
      } catch (error) {
        console.error(`Network error uploading ${file.name}:`, error);
        failedUploads.push(file.name);
      }
    }
  }

  // Save the updated list to the local UI view
  cases[caseIndex] = {
    ...cases[caseIndex],
    uploadedDocuments: currentDocs
  };
  writeCases(cases);
  renderCaseDetails(cases[caseIndex]);
  if (successCount > 0) {
    showDetailToast(`Successful (${successCount})`, "success");
  }
  if (failedUploads.length) {
    showDetailToast(`Unsuccessful - ${failedUploads.join(", ")}`, "error");
  }
}

function renderCaseDetails(entry) {
  currentCaseId = entry.id;
  const canEditCurrentCase = canEditCase(getStoredSession(), entry);
  const canModifyMetadata = canModifyCaseMetadata(getStoredSession(), entry);
  caseTitle.textContent = entry.title || "Case";
  caseMeta.textContent = `${entry.caseNumber ? `${entry.caseNumber} • ` : ""}${entry.stage || "No description"} • ${(entry.clientNames || []).join(", ")}`;
  caseDescription.textContent = entry.stage || "No description added yet.";
  caseDeadline.textContent = entry.deadline ? `Deadline: ${entry.deadline}` : "Deadline: Not set";

  caseStatusBadge.textContent = entry.status || "Active";
  caseStatusBadge.className = entry.status === "Finished" ? "badge success" : "badge";

  const uploadedDocs = normalizeUploadedDocuments(entry.uploadedDocuments);
  uploadedDocumentsGrid.innerHTML = "";
  if (!uploadedDocs.length) {
    uploadedDocumentsGrid.innerHTML =
      '<div class="rounded-[22px] border border-dashed border-slate-200 bg-slate-50/80 px-5 py-6 text-sm text-slate-500">No uploaded documents.</div>';
    detailFileCount.textContent = "No files uploaded for this case.";
  } else {
    detailFileCount.textContent = `${uploadedDocs.length} uploaded file(s) in this case.`;
    uploadedDocs.forEach((file) => {
      const card = document.createElement("div");
      card.className =
        "uploaded-file-box grid items-center gap-3 rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-indigo-200 hover:shadow-md md:grid-cols-[auto_minmax(0,2.2fr)_minmax(0,1.1fr)_auto]";
      card.draggable = true;
      card.dataset.fileName = file.name;
      card.dataset.previewUrl = file.previewUrl || "";
      card.dataset.s3Key = file.s3Key || "";
      card.dataset.mimeType = file.mimeType || "";
      card.dataset.encryptionIv = file.encryptionIv || "";
      card.dataset.encryptionTag = file.encryptionTag || "";
      const thumb = document.createElement("div");
      thumb.className = "uploaded-file-thumb flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-red-50";
      if (isImageFile(file) && file.previewUrl) {
        const image = document.createElement("img");
        image.className = "uploaded-file-thumb-image";
        image.src = file.previewUrl;
        image.alt = file.name;
        thumb.appendChild(image);
      } else {
        const label = document.createElement("span");
        label.className = "uploaded-file-thumb-label text-[11px] font-bold tracking-wide text-red-600";
        label.textContent = getFileExtension(file.name);
        thumb.appendChild(label);
      }
      const name = document.createElement("div");
      name.className = "uploaded-file-copy min-w-0";
      name.title = file.name;
      name.innerHTML = `
        <span class="uploaded-file-name block text-sm font-medium text-slate-800">${getShortDisplayFileName(file.name, 30)}</span>
        <span class="mt-1 block text-xs text-slate-500">${file.uploadedAt ? formatHistoryDateTime(file.uploadedAt) : "No upload date"}</span>
        <span class="mt-1 block text-xs text-slate-400">${file.placeholderName ? `Linked to ${file.placeholderName}` : "General case document"}</span>
      `;

      const actions = document.createElement("div");
      actions.className = "flex items-center justify-end gap-2";

      const downloadBtn = document.createElement("button");
      downloadBtn.type = "button";
      downloadBtn.className =
        "doc-download-link rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50";
      downloadBtn.dataset.s3Key = file.s3Key || "";
      downloadBtn.dataset.fileName = file.name || "file";
      downloadBtn.textContent = "Download";

      card.appendChild(thumb);
      card.appendChild(name);
      actions.appendChild(downloadBtn);
      if (canEditCurrentCase) {
        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className =
          "uploaded-file-remove flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-semibold text-slate-500";
        removeBtn.dataset.removeFileName = file.name;
        removeBtn.textContent = "x";
        actions.appendChild(removeBtn);
      }
      card.appendChild(actions);
      uploadedDocumentsGrid.appendChild(card);
    });
  }

  requiredDocsList.innerHTML = "";
  const requiredDocs = entry.requiredDocuments || [];
  if (!requiredDocs.length) {
    requiredDocsList.innerHTML =
      '<li class="rounded-[22px] border border-dashed border-slate-200 bg-slate-50/80 px-5 py-6 text-sm text-slate-500"><p>No required placeholders.</p></li>';
  } else {
    requiredDocs.forEach((doc, index) => {
      const versions = getPlaceholderVersions(doc);
      const li = document.createElement("li");
      li.className =
        "doc-placeholder-item rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm";

      const content = document.createElement("div");
      content.className = "doc-placeholder-main";

      const label = document.createElement("div");
      label.className = "doc-placeholder-label";
      label.innerHTML = `
        <p class="doc-placeholder-title text-lg font-semibold text-slate-800">${doc.name}</p>
        <p class="doc-placeholder-status mt-2 text-sm text-slate-500">${doc.status}</p>
      `;

      const dropField = document.createElement("div");
      dropField.className =
        "doc-drop-field min-h-[120px] rounded-[20px] border border-dashed border-slate-300 bg-slate-50 p-4 transition";
      dropField.dataset.docDropIndex = String(index);
      if (versions.length) {
        const attachedList = document.createElement("div");
        attachedList.className = "doc-drop-file-list flex flex-col gap-3";

        versions.forEach((attachedFile) => {
          const fileRow = document.createElement("div");
          fileRow.className =
            "doc-drop-file-item flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-3 shadow-sm";

          const fileMeta = document.createElement("div");
          fileMeta.className = "doc-drop-file-meta flex min-w-0 items-center gap-3";

          const icon = document.createElement("span");
          icon.className =
            "doc-file-icon flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-xs font-semibold text-indigo-600";
          icon.textContent = getFileIcon(attachedFile.original_name || "");

          const fileName = document.createElement("span");
          fileName.className = "doc-drop-file-name text-sm font-medium text-slate-700";
          fileName.textContent = attachedFile.original_name;

          const downloadLink = document.createElement("a");
          downloadLink.className =
            "btn-ghost btn-small doc-download-link rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50";
          downloadLink.href = getDocumentDownloadUrl(attachedFile);
          downloadLink.textContent = "Download";
          downloadLink.dataset.s3Key = attachedFile.s3_key || "";
          downloadLink.dataset.fileName = attachedFile.original_name || "file";

          fileMeta.appendChild(icon);
          fileMeta.appendChild(fileName);
          fileRow.appendChild(fileMeta);
          fileRow.appendChild(downloadLink);
          attachedList.appendChild(fileRow);
        });

        dropField.appendChild(attachedList);
      }

      if (!versions.length) {
        const dropHint = document.createElement("p");
        dropHint.className =
          "doc-drop-hint flex min-h-[88px] items-center justify-center text-center text-sm text-slate-400";
        dropHint.textContent = "Drop uploaded files or local files here";
        dropField.appendChild(dropHint);
      }

      if (canEditCurrentCase) {
        const input = document.createElement("input");
        input.type = "file";
        input.className = "hidden file-input-target";
        input.accept = SUPPORTED_UPLOAD_ACCEPT;
        input.dataset.placeholderFileInput = String(doc.id);
        input.dataset.docDropIndex = String(index);

        const addFileBtn = document.createElement("button");
        addFileBtn.type = "button";
        addFileBtn.className =
          "mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50";
        addFileBtn.dataset.addPlaceholderFile = String(doc.id);
        addFileBtn.dataset.docDropIndex = String(index);
        addFileBtn.innerHTML = '<span aria-hidden="true">+</span><span>Add File</span>';

        dropField.appendChild(addFileBtn);
        dropField.appendChild(input);
      }

      content.appendChild(label);
      content.appendChild(dropField);

      if (versions.length > 1) {
        const historyBtn = document.createElement("button");
        historyBtn.type = "button";
        historyBtn.className =
          "mt-4 inline-flex items-center gap-2 self-start rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50";
        historyBtn.dataset.historyPlaceholderId = String(doc.id);
        historyBtn.innerHTML = '<span aria-hidden="true">⏱</span><span>History</span>';
        content.appendChild(historyBtn);
      }

      li.appendChild(content);
      if (canEditCurrentCase) {
        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className =
          "btn-ghost btn-small h-fit rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50";
        removeBtn.dataset.removePlaceholderId = String(doc.id);
        removeBtn.textContent = "Remove";
        li.appendChild(removeBtn);
      }
      requiredDocsList.appendChild(li);
    });
  }

  detailDropZone.hidden = !canEditCurrentCase;
  detailCaseDocuments.disabled = !canEditCurrentCase;
  detailAddDocPlaceholderBtn.hidden = !canEditCurrentCase;
  detailDocPlaceholderName.disabled = !canEditCurrentCase;
  detailDocPlaceholderStatus.disabled = !canEditCurrentCase;
  editCaseBtn.hidden = !canEditCurrentCase;
  saveEditBtn.disabled = !canModifyMetadata;
  saveEditBtn.hidden = !canModifyMetadata;
  finishCaseBtn.hidden = !canModifyMetadata;
  deleteCaseBtn.hidden = !canDeleteCurrentCase(getStoredSession(), entry);
  renderCaseAssignments(entry);

  commentsList.innerHTML = "";
  const comments = entry.comments || [];
  if (!comments.length) {
    commentsList.innerHTML = `
      <li>
        <div>
          <strong>No comments yet.</strong>
        </div>
      </li>
    `;
  } else {
    comments.forEach((comment) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <div>
          <strong>${comment.createdAtLabel || "Update"}</strong>
          <p class="meta">${comment.text}</p>
        </div>
      `;
      commentsList.appendChild(li);
    });
  }
}

async function addRequiredPlaceholder() {
  const name = detailDocPlaceholderName.value.trim();
  const status = detailDocPlaceholderStatus.value;
  if (!name) {
    detailDocPlaceholderName.focus();
    return;
  }

  const { cases, index } = getCurrentCaseAndIndex();
  if (index < 0) return;

  try {
    const created = await createCasePlaceholders(currentCaseId, [{ name, status }]);
    const currentRequired = [...(cases[index].requiredDocuments || [])];

    created.forEach((placeholder) => {
      currentRequired.push(normalizePlaceholder(placeholder));
    });

    cases[index] = {
      ...cases[index],
      requiredDocuments: currentRequired
    };
    writeCases(cases);
    detailDocPlaceholderName.value = "";
    detailDocPlaceholderStatus.value = "Pending";
    renderCaseDetails(cases[index]);
  } catch (error) {
    console.error("Failed to create placeholder:", error);
    window.alert(error.message || "Failed to create placeholder.");
  }
}

async function linkUploadedToPlaceholder(documentMeta, placeholderIndex) {
  const { cases, index } = getCurrentCaseAndIndex();
  if (index < 0) return;
  const uploadedDocs = normalizeUploadedDocuments(cases[index].uploadedDocuments);
  if (!documentMeta?.s3Key || !uploadedDocs.some((file) => file.s3Key === documentMeta.s3Key)) return;

  const required = [...(cases[index].requiredDocuments || [])];
  if (!required[placeholderIndex]) return;

  try {
    const updatedPlaceholder = await linkPlaceholderToDocument(
      currentCaseId,
      required[placeholderIndex].id,
      {
        original_name: documentMeta.name,
        s3_key: documentMeta.s3Key,
        mime_type: documentMeta.mimeType || "",
        encryption_iv: documentMeta.encryptionIv || "",
        encryption_tag: documentMeta.encryptionTag || ""
      }
    );

    required[placeholderIndex] = {
      ...required[placeholderIndex],
      ...normalizePlaceholder(updatedPlaceholder)
    };
    cases[index] = {
      ...cases[index],
      requiredDocuments: required
    };
    writeCases(cases);
    renderCaseDetails(cases[index]);
  } catch (error) {
    console.error("Failed to link placeholder:", error);
    window.alert(error.message || "Failed to link placeholder.");
  }
}

async function uploadFilesToPlaceholder(placeholderIndex, files) {
  const { supportedFiles, unsupportedFiles } = splitDetailUploadFiles(files);
  if (unsupportedFiles.length) {
    showDetailToast(`Unsuccessful - ${unsupportedFiles.join(", ")}`, "error");
  }
  if (!supportedFiles.length) return;

  const { cases, index } = getCurrentCaseAndIndex();
  if (index < 0) return;
  const placeholder = (cases[index].requiredDocuments || [])[placeholderIndex];
  if (!placeholder) return;

  try {
    const currentDocs = normalizeUploadedDocuments(cases[index].uploadedDocuments);

    for (const selectedFile of supportedFiles) {
      const uploadData = await uploadFile(selectedFile);
      const placeholderUploadResult = await uploadPlaceholderVersion(currentCaseId, placeholder.id, {
        original_name: selectedFile.name,
        s3_key: uploadData.filePath,
        mime_type: selectedFile.type || "application/octet-stream",
        encryption_iv: uploadData.encryption_iv,
        encryption_tag: uploadData.encryption_tag
      });

      const version = placeholderUploadResult?.version || {};

      currentDocs.push({
        name: version.original_name || selectedFile.name,
        previewUrl: "",
        mimeType: version.mime_type || selectedFile.type || "",
        s3Key: version.s3_key || uploadData.filePath,
        encryptionIv: version.encryption_iv || uploadData.encryption_iv || "",
        encryptionTag: version.encryption_tag || uploadData.encryption_tag || "",
        uploadedAt: version.uploaded_at || ""
      });

      if (placeholderUploadResult?.placeholder) {
        const refreshedCases = readCases();
        const refreshedIndex = refreshedCases.findIndex((entry) => String(entry.id) === String(currentCaseId));
        if (refreshedIndex >= 0) {
          const currentRequired = [...(refreshedCases[refreshedIndex].requiredDocuments || [])];
          currentRequired[placeholderIndex] = normalizePlaceholder(placeholderUploadResult.placeholder);
          refreshedCases[refreshedIndex] = {
            ...refreshedCases[refreshedIndex],
            requiredDocuments: currentRequired
          };
          writeCases(refreshedCases);
        }
      }
    }

    const refreshedCases = readCases();
    const refreshedIndex = refreshedCases.findIndex((entry) => entry.id === currentCaseId);
    if (refreshedIndex >= 0) {
      refreshedCases[refreshedIndex] = {
        ...refreshedCases[refreshedIndex],
        uploadedDocuments: currentDocs
      };
      writeCases(refreshedCases);
      renderCaseDetails(refreshedCases[refreshedIndex]);
    }
  } catch (error) {
    console.error("Failed to upload files for placeholder:", error);
    window.alert(error.message || "Failed to upload files for this placeholder.");
  }
}

async function assignSelectedUserToCase() {
  if (!currentCaseId || !caseAssigneeSelect.value) return;

  try {
    assignCaseUserBtn.disabled = true;
    caseAssignmentsStatus.textContent = "Assigning user to this case...";
    const userId = caseAssigneeSelect.value;
    await assignUserToCase(currentCaseId, userId);

    const [refreshedAssignments, refreshedUsers] = await Promise.all([
      getCaseAssignments(currentCaseId),
      getAssignableUsers()
    ]);
    assignedUsers = refreshedAssignments;
    availableAssignees = refreshedUsers;

    const currentEntry = readCases().find((item) => String(item.id) === String(currentCaseId));
    if (currentEntry) {
      renderCaseDetails(currentEntry);
    }

    caseAssignmentsStatus.textContent = "User assigned successfully.";
  } catch (error) {
    console.error("Failed to assign user to case:", error);
    caseAssignmentsStatus.textContent = error.message || "Failed to assign user.";
  } finally {
    assignCaseUserBtn.disabled = false;
  }
}

function openEditModal() {
  const entry = readCases().find((item) => String(item.id) === String(currentCaseId));
  if (!entry) return;
  const isReadOnly = !canModifyCaseMetadata(getStoredSession(), entry);
  if (editCaseNumber) {
    editCaseNumber.value = entry.caseNumber || "";
  }
  editCaseName.value = entry.title || "";
  editClientNames.value = (entry.clientNames || []).join(", ");
  editCaseStatus.value = entry.status || "Active";
  editCaseDeadline.value = entry.deadline || "";
  editCaseDescription.value = entry.stage || "";
  editCaseComment.value = "";
  setEditModalReadOnlyState(isReadOnly);
  selectedEditAssigneeIds = new Set(assignedUsers.map((user) => String(user.id)));
  renderEditCaseTeamSelection(entry);
  editCaseModal.showModal();
}

async function handleDeleteCase() {
  if (!currentCaseId) return;

  const confirmed = window.confirm(
    "Are you sure you want to delete this case? This action cannot be undone."
  );
  if (!confirmed) return;

  try {
    await deleteCase(currentCaseId);

    const cases = readCases().filter((entry) => String(entry.id) !== String(currentCaseId));
    writeCases(cases);

    window.location.href = "cases.html";
  } catch (error) {
    window.alert(error.message || "Failed to delete case.");
  }
}

goDashboardBtn.addEventListener("click", () => {
  window.location.href = "index.html";
});

if (billingBtn) {
  billingBtn.addEventListener("click", () => {
    window.location.href = "billing.html";
  });
}

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

editCaseBtn.addEventListener("click", openEditModal);
deleteCaseBtn.addEventListener("click", handleDeleteCase);

detailDropZone.addEventListener("click", () => detailCaseDocuments.click());
detailCaseDocuments.addEventListener("change", () => {
  saveUploadedFilesToCase(Array.from(detailCaseDocuments.files || []));
  detailCaseDocuments.value = "";
});
detailDropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  detailDropZone.classList.add("drag-active");
});
detailDropZone.addEventListener("dragleave", () => {
  detailDropZone.classList.remove("drag-active");
});
detailDropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  detailDropZone.classList.remove("drag-active");
  saveUploadedFilesToCase(Array.from(event.dataTransfer.files || []));
});

uploadedDocumentsGrid.addEventListener("dragstart", (event) => {
  const fileCard = event.target.closest(".uploaded-file-box");
  if (!fileCard) return;
  event.dataTransfer.setData(
    "application/json",
    JSON.stringify({
      name: fileCard.dataset.fileName || "",
      s3Key: fileCard.dataset.s3Key || "",
      mimeType: fileCard.dataset.mimeType || "",
      encryptionIv: fileCard.dataset.encryptionIv || "",
      encryptionTag: fileCard.dataset.encryptionTag || ""
    })
  );
  event.dataTransfer.setData("text/plain", fileCard.dataset.fileName || "");
});

uploadedDocumentsGrid.addEventListener("click", (event) => {
  const downloadBtn = event.target.closest(".doc-download-link");
  if (downloadBtn) {
    event.preventDefault();
    triggerDocumentDownload({
      original_name: downloadBtn.dataset.fileName || "file",
      s3_key: downloadBtn.dataset.s3Key || ""
    });
    return;
  }

  const removeBtn = event.target.closest("[data-remove-file-name]");
  if (removeBtn) {
    removeFileFromCase(removeBtn.dataset.removeFileName);
    return;
  }

  const fileCard = event.target.closest(".uploaded-file-box");
  if (!fileCard) return;
  const previewUrl = fileCard.dataset.previewUrl || "";
  const fileName = fileCard.dataset.fileName || "file";
  const s3Key = fileCard.dataset.s3Key || "";
  if (!previewUrl && s3Key) {
    triggerDocumentDownload({ name: fileName, s3Key });
    return;
  }
  if (!previewUrl) {
    window.alert(`Preview unavailable for ${fileName}.`);
    return;
  }
  window.open(previewUrl, "_blank", "noopener,noreferrer");
});

uploadedDocumentsGrid.addEventListener("contextmenu", (event) => {
  const fileCard = event.target.closest(".uploaded-file-box");
  if (!fileCard) return;
  event.preventDefault();
  contextMenuFile = {
    name: fileCard.dataset.fileName || "",
    previewUrl: fileCard.dataset.previewUrl || "",
    s3Key: fileCard.dataset.s3Key || ""
  };
  fileContextMenu.style.left = `${event.clientX}px`;
  fileContextMenu.style.top = `${event.clientY}px`;
  fileContextMenu.classList.remove("hidden");
});

document.addEventListener("click", (event) => {
  if (event.target.closest("#fileContextMenu")) return;
  hideContextMenu();
});

ctxDownloadBtn.addEventListener("click", () => {
  if (!contextMenuFile) return;
  if (contextMenuFile.s3Key) {
    triggerDocumentDownload(contextMenuFile);
  } else if (contextMenuFile.previewUrl) {
    const link = document.createElement("a");
    link.href = contextMenuFile.previewUrl;
    link.download = contextMenuFile.name || "file";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  hideContextMenu();
});

ctxCopyBtn.addEventListener("click", async () => {
  if (!contextMenuFile) return;
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(contextMenuFile.s3Key || contextMenuFile.name || "");
    }
  } catch (error) {
    console.error("Failed to copy document reference:", error);
  }
  hideContextMenu();
});

ctxRemoveBtn.addEventListener("click", () => {
  if (!contextMenuFile) return;
  removeFileFromCase(contextMenuFile.name);
  hideContextMenu();
});

requiredDocsList.addEventListener("dragover", (event) => {
  const dropField = event.target.closest("[data-doc-drop-index]");
  if (!dropField) return;
  event.preventDefault();
  dropField.classList.add("drag-active");
});

requiredDocsList.addEventListener("dragleave", (event) => {
  const dropField = event.target.closest("[data-doc-drop-index]");
  if (!dropField) return;
  dropField.classList.remove("drag-active");
});

requiredDocsList.addEventListener("drop", (event) => {
  const dropField = event.target.closest("[data-doc-drop-index]");
  if (!dropField) return;
  event.preventDefault();
  dropField.classList.remove("drag-active");
  const placeholderIndex = Number(dropField.dataset.docDropIndex);
  if (Number.isNaN(placeholderIndex)) return;

  const { cases, index } = getCurrentCaseAndIndex();
  if (index < 0) return;
  const placeholder = (cases[index].requiredDocuments || [])[placeholderIndex];
  if (!placeholder) return;

  const droppedFiles = Array.from(event.dataTransfer.files || []);
  if (droppedFiles.length) {
    uploadFilesToPlaceholder(placeholderIndex, droppedFiles);
    return;
  }

  let documentMeta = null;
  try {
    const payload = event.dataTransfer.getData("application/json");
    documentMeta = payload ? JSON.parse(payload) : null;
  } catch (error) {
    documentMeta = null;
  }

  if (!documentMeta?.s3Key) {
    const fileName = event.dataTransfer.getData("text/plain");
    const uploadedDocs = normalizeUploadedDocuments(readCases().find((entry) => entry.id === currentCaseId)?.uploadedDocuments);
    documentMeta = uploadedDocs.find((file) => file.name === fileName) || null;
  }

  if (!documentMeta?.s3Key) return;
  linkUploadedToPlaceholder(documentMeta, placeholderIndex);
});

requiredDocsList.addEventListener("click", (event) => {
  const downloadLink = event.target.closest(".doc-download-link");
  if (downloadLink) {
    event.preventDefault();
    triggerDocumentDownload({
      original_name: downloadLink.dataset.fileName || "file",
      s3_key: downloadLink.dataset.s3Key || ""
    });
    return;
  }

  const historyBtn = event.target.closest("[data-history-placeholder-id]");
  if (historyBtn) {
    openPlaceholderHistory(historyBtn.dataset.historyPlaceholderId);
    return;
  }

  const addFileBtn = event.target.closest("[data-add-placeholder-file]");
  if (addFileBtn) {
    const dropField = addFileBtn.closest(".doc-drop-field");
    const fileInput = dropField?.querySelector("[data-placeholder-file-input]");
    fileInput?.click();
    return;
  }

  const removeBtn = event.target.closest("[data-remove-placeholder-id]");
  if (!removeBtn) return;
  removePlaceholderFromCase(removeBtn.dataset.removePlaceholderId);
});

requiredDocsList.addEventListener("change", (event) => {
  const fileInput = event.target.closest("[data-placeholder-file-input]");
  if (!fileInput) return;
  const placeholderIndex = Number(fileInput.dataset.docDropIndex);
  const files = Array.from(fileInput.files || []);
  fileInput.value = "";
  if (Number.isNaN(placeholderIndex) || !files.length) return;
  uploadFilesToPlaceholder(placeholderIndex, files);
});

detailAddDocPlaceholderBtn.addEventListener("click", addRequiredPlaceholder);
assignCaseUserBtn.addEventListener("click", assignSelectedUserToCase);

cancelEditBtn.addEventListener("click", () => {
  editCaseModal.close();
});

if (closePlaceholderHistoryBtn) {
  closePlaceholderHistoryBtn.addEventListener("click", () => {
    activeHistoryPlaceholderId = null;
    placeholderHistoryModal.close();
  });
}

if (placeholderHistoryModal) {
  placeholderHistoryModal.addEventListener("close", () => {
    activeHistoryPlaceholderId = null;
  });
}

if (placeholderHistoryTimeline) {
  placeholderHistoryTimeline.addEventListener("click", (event) => {
    const downloadBtn = event.target.closest("[data-history-s3-key]");
    if (!downloadBtn) return;
    triggerDocumentDownload({
      original_name: downloadBtn.dataset.historyFileName || "file",
      s3_key: downloadBtn.dataset.historyS3Key || ""
    });
  });
}

if (editCaseTeamList) {
  editCaseTeamList.addEventListener("change", (event) => {
    const checkbox = event.target.closest("[data-edit-case-assignee]");
    if (!checkbox) return;
    if (checkbox.checked) {
      selectedEditAssigneeIds.add(String(checkbox.value));
    } else {
      selectedEditAssigneeIds.delete(String(checkbox.value));
    }
  });
}

saveEditBtn.addEventListener("click", async () => {
  if (!currentCaseId) return;
  const cases = readCases();
  const caseIndex = cases.findIndex((entry) => String(entry.id) === String(currentCaseId));
  if (caseIndex < 0) return;
  if (!canModifyCaseMetadata(getStoredSession(), cases[caseIndex])) {
    editCaseModal.close();
    return;
  }

  const title = editCaseName.value.trim();
  const clients = parseClientNames(editClientNames.value);
  const status = editCaseStatus.value;
  const deadline = editCaseDeadline.value;
  const description = editCaseDescription.value.trim();
  const commentText = editCaseComment.value.trim();
  if (!title) {
    editCaseName.focus();
    return;
  }
  if (!clients.length) {
    editClientNames.focus();
    return;
  }

  let resolvedClientId = cases[caseIndex].client_id;

  try {
    const clientsList = await getClients();
    const matchedClient = clientsList.find(
      (client) => client.full_name.trim().toLowerCase() === clients[0].trim().toLowerCase()
    );

    if (!matchedClient) {
      editClientNames.focus();
      window.alert(`Client "${clients[0]}" was not found. Please use an existing client.`);
      return;
    }

    resolvedClientId = matchedClient.id;
  } catch (error) {
    window.alert(error.message || "Failed to validate client.");
    return;
  }

  const existingComments = cases[caseIndex].comments || [];
  const comments = commentText
    ? [
        { text: commentText, createdAt: Date.now(), createdAtLabel: new Date().toLocaleString() },
        ...existingComments
      ]
    : existingComments;

  try {
    const updatedCase = await updateCase(currentCaseId, {
      name: title,
      client_id: resolvedClientId,
      status,
      deadline: deadline || null,
      short_description: description || ""
    });

    cases[caseIndex] = {
      ...cases[caseIndex],
      id: updatedCase.id,
      title: updatedCase.name,
      client_id: updatedCase.client_id,
      clientNames: clients,
      status: updatedCase.status || status,
      deadline: updatedCase.deadline || "",
      stage: updatedCase.short_description || "No description",
      comments
    };

    if (selectedEditAssigneeIds.size > 0) {
      await Promise.all(
        Array.from(selectedEditAssigneeIds).map((userId) => assignUserToCase(currentCaseId, userId))
      );
      assignedUsers = await getCaseAssignments(currentCaseId);
    }

    writeCases(cases);
    editCaseModal.close();
    renderCaseDetails(cases[caseIndex]);
  } catch (error) {
    window.alert(error.message || "Failed to save case changes.");
  }
});

finishCaseBtn.addEventListener("click", () => {
  editCaseStatus.value = "Finished";
  saveEditBtn.click();
});
async function initPage() {
  const caseId = getCaseIdFromQuery();
  if (!caseId) {
    window.location.href = "cases.html";
    return;
  }

  try {
    const entry = await getCaseById(caseId);
    const optionalResults = await Promise.allSettled([
      getCaseDocuments(caseId),
      getCasePlaceholders(caseId),
      getCaseAssignments(caseId),
      getAssignableUsers()
    ]);

    const documents =
      optionalResults[0]?.status === "fulfilled" && Array.isArray(optionalResults[0].value)
        ? optionalResults[0].value
        : [];
    const placeholders =
      optionalResults[1]?.status === "fulfilled" && Array.isArray(optionalResults[1].value)
        ? optionalResults[1].value
        : [];
    assignedUsers =
      optionalResults[2]?.status === "fulfilled" && Array.isArray(optionalResults[2].value)
        ? optionalResults[2].value
        : [];
    availableAssignees =
      optionalResults[3]?.status === "fulfilled" && Array.isArray(optionalResults[3].value)
        ? optionalResults[3].value
        : [];

    const storedCase = readCases().find((item) => String(item.id) === String(caseId));

    const mergedCase = mergeCaseIntoLocal({
      id: entry.id,
      client_id: entry.client_id,
      owner_id: entry.owner_id || null,
      title: entry.name,
      caseNumber: entry.case_number || "",
      stage: entry.short_description || "No description",
      clientNames: entry.client_name ? [entry.client_name] : [],
      status: entry.status || "open",
      can_edit: Boolean(entry.can_edit),
      is_owner: Boolean(entry.is_owner),
      is_assigned: Boolean(entry.is_assigned),
      deadline: entry.deadline || "",
      comments: storedCase?.comments || [],
      requiredDocuments: placeholders.map((placeholder) => ({
        ...normalizePlaceholder(placeholder)
      })),
      uploadedDocuments: documents.map((document) => ({
        name: document.original_name,
        previewUrl: "",
        mimeType: document.mime_type || "",
        s3Key: document.s3_key,
        encryptionIv: document.encryption_iv || "",
        encryptionTag: document.encryption_tag || "",
        uploadedAt: document.uploaded_at || ""
      }))
    });

    renderCaseDetails(mergedCase);
  } catch (error) {
    console.error("Failed to load case detail:", error);
    if (String(error.message || "").toLowerCase().includes("not found")) {
      window.location.href = "cases.html";
      return;
    }

    window.alert(error.message || "Failed to load this case.");
  }
}
requireSession();
applyTheme(readTheme());
renderLoggedInUser();
ensureDetailUploadInputHints();
initPage();
