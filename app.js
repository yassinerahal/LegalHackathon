const state = {
  cases: [
    { title: "Al-Hassan vs Vertex Ltd", stage: "Discovery", clientName: "Maya Al-Hassan" },
    { title: "Estate Planning - M. Karim", stage: "Drafting", clientName: "Mina Karim" },
    { title: "Labor Dispute - Noor Group", stage: "Hearing Prep", clientName: "Noor Group" }
  ],
  deadlines: [
    { title: "File motion for Vertex case", date: "2026-03-23" },
    { title: "Client review meeting", date: "2026-03-25" },
    { title: "Submit compliance checklist", date: "2026-03-27" }
  ],
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

const quickAddModal = document.getElementById("quickAddModal");
const newItemBtn = document.getElementById("newItemBtn");
const cancelBtn = document.getElementById("cancelBtn");
const saveBtn = document.getElementById("saveBtn");

const caseName = document.getElementById("caseName");
const clientName = document.getElementById("clientName");
const clientStatus = document.getElementById("clientStatus");
const showClientFormBtn = document.getElementById("showClientFormBtn");
const clientForm = document.getElementById("clientForm");

const clientFullName = document.getElementById("clientFullName");
const clientAddress = document.getElementById("clientAddress");
const clientEmail = document.getElementById("clientEmail");
const clientPhone = document.getElementById("clientPhone");
const saveClientBtn = document.getElementById("saveClientBtn");

const caseDeadline = document.getElementById("caseDeadline");
const caseDescription = document.getElementById("caseDescription");
const dropZone = document.getElementById("dropZone");
const caseDocuments = document.getElementById("caseDocuments");
const fileCount = document.getElementById("fileCount");
const screenDropOverlay = document.getElementById("screenDropOverlay");

let selectedFiles = [];
let dragDepth = 0;

function normalizeName(value) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function findClientByName(name) {
  const lookup = normalizeName(name);
  return state.clients.find((client) => normalizeName(client.name) === lookup);
}

function formatDate(dateValue) {
  if (!dateValue) return "TBD";
  const date = new Date(`${dateValue}T00:00:00`);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function renderStats() {
  activeCases.textContent = state.cases.length;
  totalClients.textContent = state.clients.length;
  upcomingDeadlines.textContent = state.deadlines.length;
  pendingDocs.textContent = state.documents;
}

function renderCases() {
  caseList.innerHTML = "";
  state.cases.forEach((entry) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <div>
        <strong>${entry.title}</strong>
        <p class="meta">${entry.stage} • ${entry.clientName}</p>
      </div>
      <span class="badge">Active</span>
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
  caseName.value = "";
  clientName.value = "";
  caseDeadline.value = "";
  caseDescription.value = "";
  selectedFiles = [];
  fileCount.textContent = "";
  clientStatus.textContent = "";
  clientStatus.className = "field-note";
  clientForm.classList.add("hidden");
  dragDepth = 0;
  screenDropOverlay.classList.add("hidden");
  clearClientForm();
}

function updateClientStatus() {
  const name = clientName.value.trim();
  if (!name) {
    clientStatus.textContent = "";
    clientStatus.className = "field-note";
    return;
  }

  const existingClient = findClientByName(name);
  if (existingClient) {
    clientStatus.textContent = "Client found.";
    clientStatus.className = "field-note success";
  } else {
    clientStatus.textContent = "Client not found. Click Add Client.";
    clientStatus.className = "field-note error";
  }
}

function updateSelectedFiles(files) {
  selectedFiles = Array.from(files || []);
  if (!selectedFiles.length) {
    fileCount.textContent = "No files selected.";
    return;
  }
  fileCount.textContent = `${selectedFiles.length} file(s) selected.`;
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
clientName.addEventListener("input", updateClientStatus);

showClientFormBtn.addEventListener("click", () => {
  clientForm.classList.toggle("hidden");
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
  clientName.value = name;
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
  const client = clientName.value.trim();
  const deadline = caseDeadline.value;
  const description = caseDescription.value.trim();
  const existingClient = findClientByName(client);

  if (!title) {
    caseName.focus();
    return;
  }

  if (!client || !existingClient) {
    clientStatus.textContent = "Please select an existing client or add a new one.";
    clientStatus.className = "field-note error";
    clientName.focus();
    return;
  }

  state.cases.unshift({
    title,
    stage: description || "New case",
    clientName: existingClient.name
  });

  if (deadline) {
    state.deadlines.unshift({
      title: `${title} deadline`,
      date: deadline
    });
  }

  state.documents += selectedFiles.length;

  dragDepth = 0;
  screenDropOverlay.classList.add("hidden");
  quickAddModal.close();
  render();
});

render();
