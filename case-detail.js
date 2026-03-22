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
          uploadedAt: document.uploadedAt || ""
        }))
      }))
    )
  );
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

function isImageFile(file) {
  return file.mimeType && file.mimeType.startsWith("image/");
}

function normalizeUploadedDocuments(documents) {
  return (documents || []).map((item) =>
    typeof item === "string"
      ? { name: item, previewUrl: "", mimeType: "", s3Key: "", uploadedAt: "" }
      : {
          name: item.name,
          previewUrl: item.previewUrl || "",
          mimeType: item.mimeType || "",
          s3Key: item.s3Key || "",
          uploadedAt: item.uploadedAt || ""
        }
  );
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
          mime_type: file.type || "application/octet-stream"
        });

        currentDocs.push({
          name: linkedDocument.original_name,
          previewUrl: "",
          mimeType: linkedDocument.mime_type || file.type || "",
          s3Key: linkedDocument.s3_key,
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
      if (Array.isArray(doc.attachedFiles) && doc.attachedFiles.length) {
        const attachedList = document.createElement("div");
        attachedList.className = "doc-drop-file-list";

        doc.attachedFiles.forEach((attachedFile) => {
          const fileChip = document.createElement("span");
          fileChip.className = "doc-drop-thumb-label";
          fileChip.textContent = attachedFile.original_name;
          attachedList.appendChild(fileChip);
        });

        dropField.appendChild(attachedList);
      }

      const dropHint = document.createElement("p");
      dropHint.className = "doc-drop-hint";
      dropHint.textContent = doc.attachedFiles?.length
        ? "Drop more files here to attach them to this placeholder"
        : "Drop uploaded files or local files here";
      dropField.appendChild(dropHint);

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
        mime_type: documentMeta.mimeType || ""
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
  event.dataTransfer.setData(
    "application/json",
    JSON.stringify({
      name: fileCard.dataset.fileName || "",
      s3Key: fileCard.dataset.s3Key || ""
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
            mime_type: droppedFile.type || "application/octet-stream"
          });

          currentDocs.push({
            name: linkedDocument.original_name,
            previewUrl: "",
            mimeType: linkedDocument.mime_type || droppedFile.type || "",
            s3Key: linkedDocument.s3_key,
            uploadedAt: linkedDocument.uploaded_at || ""
          });

          await linkUploadedToPlaceholder(
            {
              name: linkedDocument.original_name,
              s3Key: linkedDocument.s3_key,
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
async function initPage() {
  const caseId = getCaseIdFromQuery();
  if (!caseId) {
    window.location.href = "cases.html";
    return;
  }

  try {
    const [entry, documents, placeholders] = await Promise.all([
      getCaseById(caseId),
      getCaseDocuments(caseId),
      getCasePlaceholders(caseId)
    ]);
    const storedCase = readCases().find((item) => String(item.id) === String(caseId));

    const mergedCase = {
      id: entry.id,
      title: entry.name,
      stage: entry.short_description || "No description",
      clientNames: entry.client_name ? [entry.client_name] : [],
      status: entry.status || "open",
      deadline: entry.deadline || "",
      comments: storedCase?.comments || [],
      requiredDocuments: placeholders.map((placeholder) => {
        return {
          id: placeholder.id,
          name: placeholder.name,
          status: placeholder.status || "Pending",
          attachedFiles: Array.isArray(placeholder.attached_files) ? placeholder.attached_files : []
        };
      }),
      uploadedDocuments: documents.map((document) => ({
        name: document.original_name,
        previewUrl: "",
        mimeType: document.mime_type || "",
        s3Key: document.s3_key,
        uploadedAt: document.uploaded_at || ""
      }))
    };

    const allCases = readCases();
    const existingIndex = allCases.findIndex((item) => String(item.id) === String(caseId));
    if (existingIndex >= 0) {
      allCases[existingIndex] = {
        ...allCases[existingIndex],
        ...mergedCase
      };
    } else {
      allCases.push(mergedCase);
    }
    writeCases(allCases);

    renderCaseDetails(mergedCase);
  } catch (error) {
    console.error(error);
    window.location.href = "cases.html";
  }
}

requireSession();
applyTheme(readTheme());
renderLoggedInUser();
initPage();
