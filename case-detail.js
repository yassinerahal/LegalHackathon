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
const logoutBtn = document.getElementById("logoutBtn");
const deleteCaseBtn = document.getElementById("deleteCaseBtn");
const editCaseBtn = document.getElementById("editCaseBtn");
const editCaseModal = document.getElementById("editCaseModal");
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
const fileContextMenu = document.getElementById("fileContextMenu");
const ctxDownloadBtn = document.getElementById("ctxDownloadBtn");
const ctxCopyBtn = document.getElementById("ctxCopyBtn");
const ctxRemoveBtn = document.getElementById("ctxRemoveBtn");

let currentCaseId = null;
let contextMenuFile = null;
let availableAssignees = [];
let assignedUsers = [];
let selectedEditAssigneeIds = new Set();

function requireSession() {
  return requireStaffSession();
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
          attachedFiles: Array.isArray(document.attachedFiles) ? document.attachedFiles : []
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
    const attachedFiles = (doc.attachedFiles || []).filter((entry) => entry.original_name !== fileName);
    return {
      ...doc,
      status: attachedFiles.length ? "Uploaded" : "Pending",
      attachedFiles
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
    caseAssignmentsList.innerHTML = '<li><p class="field-note">No additional users assigned yet.</p></li>';
    return;
  }

  assignedUsers.forEach((user) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <div>
        <strong>${user.full_name || user.username}</strong>
        <p class="meta">${user.email} • ${user.role}</p>
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
            data-edit-case-assignee
            value="${user.id}"
            ${selectedEditAssigneeIds.has(String(user.id)) ? "checked" : ""}
          />
          <span>${user.full_name || user.username} (${user.role})</span>
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
  const cases = readCases();
  const caseIndex = cases.findIndex((entry) => entry.id === currentCaseId);
  if (caseIndex < 0) return;

  const currentDocs = normalizeUploadedDocuments(cases[caseIndex].uploadedDocuments);
  const existing = new Set(currentDocs.map((file) => file.name));

  for (const file of files) {
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
      } catch (error) {
        console.error(`Network error uploading ${file.name}:`, error);
        alert(error.message || `Failed to upload ${file.name}.`);
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
}

function renderCaseDetails(entry) {
  currentCaseId = entry.id;
  const canEditCurrentCase = canEditCase(getStoredSession(), entry);
  const canModifyMetadata = canModifyCaseMetadata(getStoredSession(), entry);
  caseTitle.textContent = entry.title || "Case";
  caseMeta.textContent = `${entry.stage || "No description"} • ${(entry.clientNames || []).join(", ")}`;
  caseDescription.textContent = entry.stage || "No description added yet.";
  caseDeadline.textContent = entry.deadline ? `Deadline: ${entry.deadline}` : "Deadline: Not set";

  caseStatusBadge.textContent = entry.status || "Active";
  caseStatusBadge.className = entry.status === "Finished" ? "badge success" : "badge";

  const uploadedDocs = normalizeUploadedDocuments(entry.uploadedDocuments);
  uploadedDocumentsGrid.innerHTML = "";
  if (!uploadedDocs.length) {
    uploadedDocumentsGrid.innerHTML = '<p class="field-note">No uploaded documents.</p>';
    detailFileCount.textContent = "No files uploaded for this case.";
  } else {
    detailFileCount.textContent = `${uploadedDocs.length} uploaded file(s) in this case.`;
    uploadedDocs.forEach((file) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "uploaded-file-box";
      card.draggable = true;
      card.dataset.fileName = file.name;
      card.dataset.previewUrl = file.previewUrl || "";
      card.dataset.s3Key = file.s3Key || "";
      card.dataset.mimeType = file.mimeType || "";
      card.dataset.encryptionIv = file.encryptionIv || "";
      card.dataset.encryptionTag = file.encryptionTag || "";
      const thumb = document.createElement("div");
      thumb.className = "uploaded-file-thumb";
      if (isImageFile(file) && file.previewUrl) {
        const image = document.createElement("img");
        image.className = "uploaded-file-thumb-image";
        image.src = file.previewUrl;
        image.alt = file.name;
        thumb.appendChild(image);
      } else {
        const label = document.createElement("span");
        label.className = "uploaded-file-thumb-label";
        label.textContent = getFileExtension(file.name);
        thumb.appendChild(label);
      }
      const name = document.createElement("span");
      name.className = "uploaded-file-name";
      name.textContent = file.name;

      card.appendChild(thumb);
      card.appendChild(name);
      if (canEditCurrentCase) {
        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "uploaded-file-remove";
        removeBtn.dataset.removeFileName = file.name;
        removeBtn.textContent = "x";
        card.appendChild(removeBtn);
      }
      uploadedDocumentsGrid.appendChild(card);
    });
  }

  requiredDocsList.innerHTML = "";
  const requiredDocs = entry.requiredDocuments || [];
  if (!requiredDocs.length) {
    requiredDocsList.innerHTML = '<li class="doc-placeholder-item"><p>No required placeholders.</p></li>';
  } else {
    requiredDocs.forEach((doc, index) => {
      const li = document.createElement("li");
      li.className = "doc-placeholder-item";

      const label = document.createElement("p");
      label.textContent = `${doc.name} • ${doc.status}`;

      const dropField = document.createElement("div");
      dropField.className = "doc-drop-field";
      dropField.dataset.docDropIndex = String(index);
      if (Array.isArray(doc.attachedFiles) && doc.attachedFiles.length) {
        const attachedList = document.createElement("div");
        attachedList.className = "doc-drop-file-list";

        doc.attachedFiles.forEach((attachedFile) => {
          const fileRow = document.createElement("div");
          fileRow.className = "doc-drop-file-item";

          const fileMeta = document.createElement("div");
          fileMeta.className = "doc-drop-file-meta";

          const icon = document.createElement("span");
          icon.className = "doc-file-icon";
          icon.textContent = getFileIcon(attachedFile.original_name || "");

          const fileName = document.createElement("span");
          fileName.className = "doc-drop-file-name";
          fileName.textContent = attachedFile.original_name;

          const downloadLink = document.createElement("a");
          downloadLink.className = "btn-ghost btn-small doc-download-link";
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

      if (!doc.attachedFiles?.length) {
        const dropHint = document.createElement("p");
        dropHint.className = "doc-drop-hint";
        dropHint.textContent = "Drop uploaded files or local files here";
        dropField.appendChild(dropHint);
      }

      li.appendChild(label);
      li.appendChild(dropField);
      if (canEditCurrentCase) {
        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "btn-ghost btn-small";
        removeBtn.dataset.removeDocIndex = String(index);
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
      currentRequired.push({
        id: placeholder.id,
        name: placeholder.name,
        status: placeholder.status || "Pending",
        attachedFiles: Array.isArray(placeholder.attached_files) ? placeholder.attached_files : []
      });
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
      id: updatedPlaceholder.id,
      status: updatedPlaceholder.status || "Uploaded",
      attachedFiles: Array.isArray(updatedPlaceholder.attached_files) ? updatedPlaceholder.attached_files : []
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
    (async () => {
      try {
        const currentDocs = normalizeUploadedDocuments(cases[index].uploadedDocuments);

        for (const droppedFile of droppedFiles) {
          const uploadData = await uploadFile(droppedFile);
          const linkedDocument = await linkCaseDocument(currentCaseId, {
            original_name: droppedFile.name,
            s3_key: uploadData.filePath,
            mime_type: droppedFile.type || "application/octet-stream",
            encryption_iv: uploadData.encryption_iv,
            encryption_tag: uploadData.encryption_tag
          });

          currentDocs.push({
            name: linkedDocument.original_name,
            previewUrl: "",
            mimeType: linkedDocument.mime_type || droppedFile.type || "",
            s3Key: linkedDocument.s3_key,
            encryptionIv: linkedDocument.encryption_iv || "",
            encryptionTag: linkedDocument.encryption_tag || "",
            uploadedAt: linkedDocument.uploaded_at || ""
          });

          await linkUploadedToPlaceholder(
            {
              name: linkedDocument.original_name,
              s3Key: linkedDocument.s3_key,
              encryptionIv: linkedDocument.encryption_iv || "",
              encryptionTag: linkedDocument.encryption_tag || "",
              mimeType: linkedDocument.mime_type || droppedFile.type || ""
            },
            placeholderIndex
          );
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
        console.error("Failed to auto-upload files for placeholder:", error);
        window.alert(error.message || "Failed to upload files for this placeholder.");
      }
    })();
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

  const removeBtn = event.target.closest("[data-remove-doc-index]");
  if (!removeBtn) return;
  const placeholderIndex = Number(removeBtn.dataset.removeDocIndex);
  if (Number.isNaN(placeholderIndex)) return;
  const { cases, index } = getCurrentCaseAndIndex();
  if (index < 0) return;
  const required = [...(cases[index].requiredDocuments || [])];
  required.splice(placeholderIndex, 1);
  cases[index] = {
    ...cases[index],
    requiredDocuments: required
  };
  writeCases(cases);
  renderCaseDetails(cases[index]);
});

detailAddDocPlaceholderBtn.addEventListener("click", addRequiredPlaceholder);
assignCaseUserBtn.addEventListener("click", assignSelectedUserToCase);

cancelEditBtn.addEventListener("click", () => {
  editCaseModal.close();
});

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
      stage: entry.short_description || "No description",
      clientNames: entry.client_name ? [entry.client_name] : [],
      status: entry.status || "open",
      can_edit: Boolean(entry.can_edit),
      is_owner: Boolean(entry.is_owner),
      is_assigned: Boolean(entry.is_assigned),
      deadline: entry.deadline || "",
      comments: storedCase?.comments || [],
      requiredDocuments: placeholders.map((placeholder) => ({
        id: placeholder.id,
        name: placeholder.name,
        status: placeholder.status || "Pending",
        attachedFiles: Array.isArray(placeholder.attached_files)
          ? placeholder.attached_files
          : []
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
initPage();
