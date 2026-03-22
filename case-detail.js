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
const goDashboardBtn = document.getElementById("goDashboardBtn");
const loggedInUserName = document.getElementById("loggedInUserName");
const toggleDarkModeBtn = document.getElementById("toggleDarkModeBtn");
const logoutBtn = document.getElementById("logoutBtn");
const editCaseBtn = document.getElementById("editCaseBtn");
const editCaseModal = document.getElementById("editCaseModal");
const editCaseName = document.getElementById("editCaseName");
const editClientNames = document.getElementById("editClientNames");
const editCaseStatus = document.getElementById("editCaseStatus");
const editCaseDeadline = document.getElementById("editCaseDeadline");
const editCaseDescription = document.getElementById("editCaseDescription");
const editCaseComment = document.getElementById("editCaseComment");
const finishCaseBtn = document.getElementById("finishCaseBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const saveEditBtn = document.getElementById("saveEditBtn");
const fileContextMenu = document.getElementById("fileContextMenu");
const ctxDownloadBtn = document.getElementById("ctxDownloadBtn");
const ctxCopyBtn = document.getElementById("ctxCopyBtn");
const ctxRemoveBtn = document.getElementById("ctxRemoveBtn");

let currentCaseId = null;
let contextMenuFile = null;

function requireSession() {
  if (!localStorage.getItem(SESSION_KEY)) window.location.href = "login.html";
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
  localStorage.setItem(CASES_KEY, JSON.stringify(cases));
}

function getCurrentCaseAndIndex() {
  const cases = readCases();
  const index = cases.findIndex((entry) => entry.id === currentCaseId);
  return { cases, index };
}

function hideContextMenu() {
  fileContextMenu.classList.add("hidden");
  contextMenuFile = null;
}

function dataUrlToBlob(dataUrl) {
  const parts = dataUrl.split(",");
  const mimeMatch = parts[0].match(/data:(.*?);base64/);
  const mimeType = mimeMatch ? mimeMatch[1] : "application/octet-stream";
  const binary = atob(parts[1] || "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

function removeFileFromCase(fileName) {
  const { cases, index } = getCurrentCaseAndIndex();
  if (index < 0) return;
  const uploadedDocuments = normalizeUploadedDocuments(cases[index].uploadedDocuments).filter(
    (file) => file.name !== fileName
  );
  const requiredDocuments = (cases[index].requiredDocuments || []).map((doc) => {
    if (doc.uploadedFileName !== fileName) return doc;
    return { ...doc, status: "Pending", uploadedFileName: "" };
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

function isImageFile(file) {
  return file.mimeType && file.mimeType.startsWith("image/");
}

function normalizeUploadedDocuments(documents) {
  return (documents || []).map((item) =>
    typeof item === "string"
      ? { name: item, previewUrl: "", mimeType: "" }
      : { name: item.name, previewUrl: item.previewUrl || "", mimeType: item.mimeType || "" }
  );
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
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
      let dataUrl = "";
      try {
        dataUrl = await fileToDataUrl(file);
      } catch (error) {
        dataUrl = URL.createObjectURL(file);
      }
      currentDocs.push({
        name: file.name,
        previewUrl: dataUrl,
        mimeType: file.type || ""
      });
      existing.add(file.name);
    }
  }

  cases[caseIndex] = {
    ...cases[caseIndex],
    uploadedDocuments: currentDocs
  };
  writeCases(cases);
  renderCaseDetails(cases[caseIndex]);
}

function renderCaseDetails(entry) {
  currentCaseId = entry.id;
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

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "uploaded-file-remove";
      removeBtn.dataset.removeFileName = file.name;
      removeBtn.textContent = "x";
      card.appendChild(thumb);
      card.appendChild(name);
      card.appendChild(removeBtn);
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
      if (doc.uploadedFileName) {
        const linkedFile = uploadedDocs.find((file) => file.name === doc.uploadedFileName);
        if (linkedFile && isImageFile(linkedFile) && linkedFile.previewUrl) {
          const image = document.createElement("img");
          image.className = "doc-drop-thumb-image";
          image.src = linkedFile.previewUrl;
          image.alt = linkedFile.name;
          dropField.appendChild(image);
        } else {
          const typeLabel = document.createElement("span");
          typeLabel.className = "doc-drop-thumb-label";
          typeLabel.textContent = getFileExtension(doc.uploadedFileName);
          dropField.appendChild(typeLabel);
        }
        const linkedText = document.createElement("span");
        linkedText.textContent = `Linked: ${doc.uploadedFileName}`;
        dropField.appendChild(linkedText);
      } else {
        dropField.textContent = "Drop an uploaded file here";
      }

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "btn-ghost btn-small";
      removeBtn.dataset.removeDocIndex = String(index);
      removeBtn.textContent = "Remove";

      li.appendChild(label);
      li.appendChild(dropField);
      li.appendChild(removeBtn);
      requiredDocsList.appendChild(li);
    });
  }

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

function addRequiredPlaceholder() {
  const name = detailDocPlaceholderName.value.trim();
  const status = detailDocPlaceholderStatus.value;
  if (!name) {
    detailDocPlaceholderName.focus();
    return;
  }

  const { cases, index } = getCurrentCaseAndIndex();
  if (index < 0) return;
  const currentRequired = cases[index].requiredDocuments || [];
  currentRequired.push({
    id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    status
  });
  cases[index] = {
    ...cases[index],
    requiredDocuments: currentRequired
  };
  writeCases(cases);
  detailDocPlaceholderName.value = "";
  detailDocPlaceholderStatus.value = "Pending";
  renderCaseDetails(cases[index]);
}

function linkUploadedToPlaceholder(fileName, placeholderIndex) {
  const { cases, index } = getCurrentCaseAndIndex();
  if (index < 0) return;
  const uploadedDocs = normalizeUploadedDocuments(cases[index].uploadedDocuments);
  if (!uploadedDocs.some((file) => file.name === fileName)) return;

  const required = [...(cases[index].requiredDocuments || [])];
  if (!required[placeholderIndex]) return;
  required[placeholderIndex] = {
    ...required[placeholderIndex],
    status: "Uploaded",
    uploadedFileName: fileName
  };
  cases[index] = {
    ...cases[index],
    requiredDocuments: required
  };
  writeCases(cases);
  renderCaseDetails(cases[index]);
}

function openEditModal() {
  const entry = readCases().find((item) => item.id === currentCaseId);
  if (!entry) return;
  editCaseName.value = entry.title || "";
  editClientNames.value = (entry.clientNames || []).join(", ");
  editCaseStatus.value = entry.status || "Active";
  editCaseDeadline.value = entry.deadline || "";
  editCaseDescription.value = entry.stage || "";
  editCaseComment.value = "";
  editCaseModal.showModal();
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
  localStorage.removeItem(SESSION_KEY);
  window.location.href = "login.html";
});

editCaseBtn.addEventListener("click", openEditModal);

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
    previewUrl: fileCard.dataset.previewUrl || ""
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
  if (!contextMenuFile || !contextMenuFile.previewUrl) return;
  const link = document.createElement("a");
  link.href = contextMenuFile.previewUrl;
  link.download = contextMenuFile.name || "file";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  hideContextMenu();
});

ctxCopyBtn.addEventListener("click", async () => {
  if (!contextMenuFile || !contextMenuFile.previewUrl) return;
  try {
    if (navigator.clipboard && window.ClipboardItem) {
      const blob = dataUrlToBlob(contextMenuFile.previewUrl);
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(contextMenuFile.previewUrl);
    }
  } catch (error) {
    // Fallback: copy the data URL as text.
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(contextMenuFile.previewUrl);
    }
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
  const fileName = event.dataTransfer.getData("text/plain");
  const placeholderIndex = Number(dropField.dataset.docDropIndex);
  if (!fileName || Number.isNaN(placeholderIndex)) return;
  linkUploadedToPlaceholder(fileName, placeholderIndex);
});

requiredDocsList.addEventListener("click", (event) => {
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

cancelEditBtn.addEventListener("click", () => {
  editCaseModal.close();
});

saveEditBtn.addEventListener("click", () => {
  if (!currentCaseId) return;
  const cases = readCases();
  const caseIndex = cases.findIndex((entry) => entry.id === currentCaseId);
  if (caseIndex < 0) return;

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

  const existingComments = cases[caseIndex].comments || [];
  const comments = commentText
    ? [
        { text: commentText, createdAt: Date.now(), createdAtLabel: new Date().toLocaleString() },
        ...existingComments
      ]
    : existingComments;

  cases[caseIndex] = {
    ...cases[caseIndex],
    title,
    clientNames: clients,
    status,
    deadline,
    stage: description || "New case",
    comments
  };

  writeCases(cases);
  editCaseModal.close();
  renderCaseDetails(cases[caseIndex]);
});

finishCaseBtn.addEventListener("click", () => {
  editCaseStatus.value = "Finished";
  saveEditBtn.click();
});

requireSession();
applyTheme(readTheme());
renderLoggedInUser();
const caseId = getCaseIdFromQuery();
const caseEntry = readCases().find((entry) => entry.id === caseId);
if (!caseEntry) {
  window.location.href = "cases.html";
} else {
  renderCaseDetails(caseEntry);
}
