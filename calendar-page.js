const SESSION_KEY = "nextact_current_user";
const THEME_KEY = "nextact_theme";

const calendarGrid = document.getElementById("calendarGrid");
const calendarMonthLabel = document.getElementById("calendarMonthLabel");
const calendarPrevBtn = document.getElementById("calendarPrevBtn");
const calendarNextBtn = document.getElementById("calendarNextBtn");
const goDashboardBtn = document.getElementById("goDashboardBtn");
const loggedInUserName = document.getElementById("loggedInUserName");
const toggleDarkModeBtn = document.getElementById("toggleDarkModeBtn");
const logoutBtn = document.getElementById("logoutBtn");

let calendarCursor = new Date();

function requireSession() {
  const sessionRaw = localStorage.getItem(SESSION_KEY);
  if (!sessionRaw) {
    window.location.href = "login.html";
  }
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

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

async function renderCalendar() {
  calendarGrid.innerHTML = "";

  let cases = [];
  try {
    cases = await getCases();
  } catch (error) {
    cases = [];
  }

  const year = calendarCursor.getFullYear();
  const month = calendarCursor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const byDate = new Map();

  cases.forEach((entry) => {
    if (!entry.deadline) return;
    const events = byDate.get(entry.deadline) || [];
    events.push(entry.name);
    byDate.set(entry.deadline, events);
  });

  ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach((label) => {
    const headerCell = document.createElement("div");
    headerCell.className = "calendar-header-cell";
    headerCell.textContent = label;
    calendarGrid.appendChild(headerCell);
  });

  const totalCells = 42;

  for (let index = 0; index < totalCells; index += 1) {
    const dayCell = document.createElement("div");
    dayCell.className = "calendar-day";
    let currentDate;

    if (index < startWeekday) {
      const day = prevMonthDays - (startWeekday - index - 1);
      currentDate = new Date(year, month - 1, day);
      dayCell.classList.add("muted-day");
    } else if (index >= startWeekday + daysInMonth) {
      const day = index - (startWeekday + daysInMonth) + 1;
      currentDate = new Date(year, month + 1, day);
      dayCell.classList.add("muted-day");
    } else {
      const day = index - startWeekday + 1;
      currentDate = new Date(year, month, day);
    }

    const dayNumber = document.createElement("p");
    dayNumber.className = "calendar-day-number";
    dayNumber.textContent = String(currentDate.getDate());
    dayCell.appendChild(dayNumber);

    const dayCases = byDate.get(dateKey(currentDate)) || [];
    if (dayCases.length) {
      const eventList = document.createElement("ul");
      eventList.className = "calendar-events";

      dayCases.slice(0, 3).forEach((title) => {
        const event = document.createElement("li");
        event.className = "calendar-event";
        event.textContent = title;
        eventList.appendChild(event);
      });

      dayCell.appendChild(eventList);
    }

    calendarGrid.appendChild(dayCell);
  }

  calendarMonthLabel.textContent = firstOfMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric"
  });
}

calendarPrevBtn.addEventListener("click", async () => {
  calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() - 1, 1);
  await renderCalendar();
});

calendarNextBtn.addEventListener("click", async () => {
  calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1);
  await renderCalendar();
});

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

requireSession();
applyTheme(readTheme());
renderLoggedInUser();
renderCalendar();