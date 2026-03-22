const SESSION_KEY = "nextact_current_user";
const THEME_KEY = "nextact_theme";
const BILLING_KEY = "nextact_billing_entries";

const COST_TYPES = [
  "SaaS subscription",
  "Registry request",
  "ERV submission",
  "Court filing fee",
  "Other usage"
];

const goDashboardBtn = document.getElementById("goDashboardBtn");
const loggedInUserName = document.getElementById("loggedInUserName");
const toggleDarkModeBtn = document.getElementById("toggleDarkModeBtn");
const logoutBtn = document.getElementById("logoutBtn");

const overviewMonth0Label = document.getElementById("overviewMonth0Label");
const overviewMonth0 = document.getElementById("overviewMonth0");
const overviewMonth1Label = document.getElementById("overviewMonth1Label");
const overviewMonth1 = document.getElementById("overviewMonth1");
const overviewMonth2Label = document.getElementById("overviewMonth2Label");
const overviewMonth2 = document.getElementById("overviewMonth2");

const periodMode = document.getElementById("periodMode");
const monthPickerWrap = document.getElementById("monthPickerWrap");
const filterMonth = document.getElementById("filterMonth");
const rangeWrap = document.getElementById("rangeWrap");
const filterFrom = document.getElementById("filterFrom");
const filterTo = document.getElementById("filterTo");
const filterCase = document.getElementById("filterCase");
const filterType = document.getElementById("filterType");
const sortBy = document.getElementById("sortBy");
const sortDir = document.getElementById("sortDir");
const exportCsvBtn = document.getElementById("exportCsvBtn");
const upgradePlanBtn = document.getElementById("upgradePlanBtn");

const costTableBody = document.getElementById("costTableBody");
const entryCountNote = document.getElementById("entryCountNote");
const billingEmptyState = document.getElementById("billingEmptyState");
const caseTotalsBody = document.getElementById("caseTotalsBody");

const addCostForm = document.getElementById("addCostForm");
const newDate = document.getElementById("newDate");
const newAmount = document.getElementById("newAmount");
const newType = document.getElementById("newType");
const newCaseId = document.getElementById("newCaseId");
const newDescription = document.getElementById("newDescription");

let allEntries = [];
let casesCache = [];
let filteredForTable = [];

function requireSession() {
  const sessionRaw = localStorage.getItem(SESSION_KEY);
  if (!sessionRaw) window.location.href = "login.html";
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

function readBillingEntries() {
  const raw = localStorage.getItem(BILLING_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function writeBillingEntries(entries) {
  localStorage.setItem(BILLING_KEY, JSON.stringify(entries));
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatMoney(amount) {
  const n = Number(amount);
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "EUR" }).format(n);
}

function monthKeyFromDate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function parseEntryDate(str) {
  if (!str) return null;
  const m = String(str).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function sumForMonth(entries, year, monthIndex) {
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0, 23, 59, 59);
  return entries.reduce((sum, e) => {
    const d = parseEntryDate(e.date);
    if (!d || d < start || d > end) return sum;
    return sum + Number(e.amount) || 0;
  }, 0);
}

function renderOverview(entries) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const labels = [overviewMonth0Label, overviewMonth1Label, overviewMonth2Label];
  const values = [overviewMonth0, overviewMonth1, overviewMonth2];
  for (let i = 0; i < 3; i += 1) {
    const d = new Date(y, m - i, 1);
    const total = sumForMonth(entries, d.getFullYear(), d.getMonth());
    const label = d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    labels[i].textContent = label;
    values[i].textContent = formatMoney(total);
  }
}

function getCaseLabel(caseId) {
  if (caseId == null || caseId === "") return "—";
  const c = casesCache.find((x) => String(x.id) === String(caseId));
  return c ? c.name || `Case #${caseId}` : `Case #${caseId}`;
}

function caseDetailHref(caseId) {
  if (caseId == null || caseId === "") return null;
  return `case-detail.html?id=${encodeURIComponent(caseId)}`;
}

function populateTypeSelects() {
  filterType.innerHTML = '<option value="">All types</option>';
  COST_TYPES.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    filterType.appendChild(opt);
  });
  newType.innerHTML = "";
  COST_TYPES.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    newType.appendChild(opt);
  });
}

function populateCaseSelects() {
  filterCase.innerHTML = `
    <option value="">All cases</option>
    <option value="__none__">Platform only (no case)</option>
  `;
  casesCache.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = String(c.id);
    opt.textContent = c.name || `Case #${c.id}`;
    filterCase.appendChild(opt);
  });

  newCaseId.innerHTML = '<option value="">None (platform / subscription)</option>';
  casesCache.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = String(c.id);
    opt.textContent = c.name || `Case #${c.id}`;
    newCaseId.appendChild(opt);
  });
}

function entryMatchesFilters(entry) {
  const d = parseEntryDate(entry.date);
  if (!d) return false;

  const mode = periodMode.value;
  if (mode === "month") {
    const key = filterMonth.value;
    if (key) {
      const [yy, mm] = key.split("-").map(Number);
      if (d.getFullYear() !== yy || d.getMonth() !== mm - 1) return false;
    }
  } else if (mode === "range") {
    if (filterFrom.value) {
      const from = new Date(filterFrom.value + "T00:00:00");
      if (d < from) return false;
    }
    if (filterTo.value) {
      const to = new Date(filterTo.value + "T23:59:59");
      if (d > to) return false;
    }
  }

  const cf = filterCase.value;
  if (cf === "__none__") {
    if (entry.caseId != null && entry.caseId !== "") return false;
  } else if (cf !== "") {
    if (String(entry.caseId) !== String(cf)) return false;
  }

  const tf = filterType.value;
  if (tf && entry.type !== tf) return false;

  return true;
}

function sortEntries(list) {
  const by = sortBy.value;
  const dir = sortDir.value === "asc" ? 1 : -1;
  return [...list].sort((a, b) => {
    if (by === "amount") {
      const va = Number(a.amount) || 0;
      const vb = Number(b.amount) || 0;
      return (va - vb) * dir;
    }
    const da = parseEntryDate(a.date)?.getTime() || 0;
    const db = parseEntryDate(b.date)?.getTime() || 0;
    return (da - db) * dir;
  });
}

function renderTable() {
  filteredForTable = sortEntries(allEntries.filter(entryMatchesFilters));
  costTableBody.innerHTML = "";
  entryCountNote.textContent = `${filteredForTable.length} entr${filteredForTable.length === 1 ? "y" : "ies"} shown`;

  if (!filteredForTable.length) {
    billingEmptyState.classList.remove("hidden");
    return;
  }
  billingEmptyState.classList.add("hidden");

  filteredForTable.forEach((e) => {
    const tr = document.createElement("tr");
    const href = caseDetailHref(e.caseId);
    const caseCell = href
      ? `<a href="${href}" class="billing-case-link">${escapeHtml(getCaseLabel(e.caseId))}</a>`
      : escapeHtml(getCaseLabel(e.caseId));
    tr.innerHTML = `
      <td>${escapeHtml(String(e.date || "").slice(0, 10))}</td>
      <td>${formatMoney(e.amount)}</td>
      <td>${escapeHtml(e.type || "")}</td>
      <td>${caseCell}</td>
      <td>${escapeHtml(e.description || "")}</td>
    `;
    costTableBody.appendChild(tr);
  });
}

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

function renderCaseTotals(entries) {
  const byCase = new Map();
  entries.forEach((e) => {
    const key = e.caseId != null && e.caseId !== "" ? String(e.caseId) : "__platform__";
    const cur = byCase.get(key) || { total: 0, count: 0 };
    cur.total += Number(e.amount) || 0;
    cur.count += 1;
    byCase.set(key, cur);
  });

  caseTotalsBody.innerHTML = "";
  const rows = [...byCase.entries()].sort((a, b) => b[1].total - a[1].total);
  if (!rows.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="3"><em>No cost entries yet.</em></td>`;
    caseTotalsBody.appendChild(tr);
    return;
  }

  rows.forEach(([key, data]) => {
    const tr = document.createElement("tr");
    if (key === "__platform__") {
      tr.innerHTML = `
        <td>Platform / no case</td>
        <td>${formatMoney(data.total)}</td>
        <td>${data.count}</td>
      `;
    } else {
      const href = caseDetailHref(key);
      const name = getCaseLabel(key);
      tr.innerHTML = `
        <td>${href ? `<a href="${href}" class="billing-case-link">${escapeHtml(name)}</a>` : escapeHtml(name)}</td>
        <td>${formatMoney(data.total)}</td>
        <td>${data.count}</td>
      `;
    }
    caseTotalsBody.appendChild(tr);
  });
}

function exportCsv() {
  const rows = [
    ["Date", "Amount", "Type", "CaseId", "Case name", "Description"].join(",")
  ];
  filteredForTable.forEach((e) => {
    const line = [
      String(e.date || "").slice(0, 10),
      Number(e.amount) || 0,
      csvEscape(e.type || ""),
      e.caseId != null && e.caseId !== "" ? String(e.caseId) : "",
      csvEscape(getCaseLabel(e.caseId)),
      csvEscape(e.description || "")
    ];
    rows.push(line.join(","));
  });
  const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `nextact-billing-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function csvEscape(val) {
  const s = String(val);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function seedIfEmpty(entries) {
  if (entries.length) return entries;

  let cases = [];
  try {
    cases = await getCases();
  } catch (error) {
    cases = [];
  }

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d1 = `${y}-${pad2(m + 1)}-01`;
  const d2 = `${y}-${pad2(m + 1)}-12`;
  const prev = new Date(y, m - 1, 15);
  const dPrev = `${prev.getFullYear()}-${pad2(prev.getMonth() + 1)}-15`;

  const id = () => `bill-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const seeded = [
    {
      id: id(),
      date: d1,
      amount: 149,
      type: "SaaS subscription",
      caseId: null,
      description: "NEXTACT Professional plan"
    },
    {
      id: id(),
      date: d2,
      amount: 24.5,
      type: "Registry request",
      caseId: cases[0] ? cases[0].id : null,
      description: "Melderegisterauszug"
    },
    {
      id: id(),
      date: d2,
      amount: 18,
      type: "ERV submission",
      caseId: cases[1] ? cases[1].id : cases[0] ? cases[0].id : null,
      description: "Electronic court submission fee"
    },
    {
      id: id(),
      date: dPrev,
      amount: 149,
      type: "SaaS subscription",
      caseId: null,
      description: "NEXTACT Professional plan"
    },
    {
      id: id(),
      date: dPrev,
      amount: 35,
      type: "Court filing fee",
      caseId: cases[0] ? cases[0].id : null,
      description: "District court filing"
    }
  ];

  writeBillingEntries(seeded);
  return seeded;
}

function updatePeriodUI() {
  const mode = periodMode.value;
  monthPickerWrap.classList.toggle("hidden", mode !== "month");
  rangeWrap.classList.toggle("hidden", mode !== "range");
}

function refresh() {
  renderOverview(allEntries);
  renderTable();
  renderCaseTotals(allEntries);
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

[
  periodMode,
  filterMonth,
  filterFrom,
  filterTo,
  filterCase,
  filterType,
  sortBy,
  sortDir
].forEach((el) => {
  el.addEventListener("change", () => {
    updatePeriodUI();
    renderTable();
  });
});

filterFrom.addEventListener("input", () => renderTable());
filterTo.addEventListener("input", () => renderTable());

periodMode.addEventListener("change", updatePeriodUI);

exportCsvBtn.addEventListener("click", exportCsv);

if (upgradePlanBtn) {
  upgradePlanBtn.addEventListener("click", () => {
    window.alert(
      "Upgrade your NEXTACT plan for more storage and higher limits. Contact your account team to switch plans."
    );
  });
}

addCostForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const entry = {
    id: `bill-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    date: newDate.value,
    amount: Number(newAmount.value),
    type: newType.value,
    caseId: newCaseId.value ? Number(newCaseId.value) : null,
    description: newDescription.value.trim()
  };
  if (!entry.description || Number.isNaN(entry.amount)) return;
  allEntries.unshift(entry);
  writeBillingEntries(allEntries);
  addCostForm.reset();
  const today = new Date().toISOString().slice(0, 10);
  newDate.value = today;
  refresh();
});

async function init() {
  requireSession();
  applyTheme(readTheme());
  renderLoggedInUser();

  populateTypeSelects();

  try {
    casesCache = await getCases();
  } catch (error) {
    casesCache = [];
  }
  populateCaseSelects();

  let entries = readBillingEntries();
  entries = await seedIfEmpty(entries);
  allEntries = entries;

  const now = new Date();
  filterMonth.value = monthKeyFromDate(now);
  newDate.value = now.toISOString().slice(0, 10);

  updatePeriodUI();
  refresh();
}

init();
