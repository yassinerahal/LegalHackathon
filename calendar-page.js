const SESSION_KEY = "nextact_current_user";
const DEADLINES_KEY = "nextact_deadlines";
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

function loadDeadlines() {
  const raw = localStorage.getItem(DEADLINES_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function renderCalendar() {
  calendarGrid.innerHTML = "";
  const deadlines = loadDeadlines();

  const year = calendarCursor.getFullYear();
  const month = calendarCursor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const byDate = new Map();
  deadlines.forEach((entry) => {
    if (!entry.date) return;
    const events = byDate.get(entry.date) || [];
    events.push(entry.title);
    byDate.set(entry.date, events);
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

    const dayDeadlines = byDate.get(dateKey(currentDate)) || [];
    if (dayDeadlines.length) {
      const eventList = document.createElement("ul");
      eventList.className = "calendar-events";
      dayDeadlines.slice(0, 3).forEach((title) => {
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

calendarPrevBtn.addEventListener("click", () => {
  calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() - 1, 1);
  renderCalendar();
});

calendarNextBtn.addEventListener("click", () => {
  calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1);
  renderCalendar();
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
  localStorage.removeItem(SESSION_KEY);
  window.location.href = "login.html";
});

requireSession();
applyTheme(readTheme());
renderLoggedInUser();
renderCalendar();
