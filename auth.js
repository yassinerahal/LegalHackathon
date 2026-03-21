(function () {
  const USERS_KEY = "nextact_users";
  const SESSION_KEY = "nextact_current_user";

  function readUsers() {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function writeUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  function setMessage(text, isSuccess) {
    const message = document.getElementById("authMessage");
    if (!message) return;
    message.textContent = text || "";
    message.className = isSuccess ? "message success" : "message";
  }

  function normalizeEmail(email) {
    return email.trim().toLowerCase();
  }

  function createAccount() {
    const nameInput = document.getElementById("signupName");
    const emailInput = document.getElementById("signupEmail");
    const passwordInput = document.getElementById("signupPassword");
    if (!nameInput || !emailInput || !passwordInput) return;

    const name = nameInput.value.trim();
    const email = normalizeEmail(emailInput.value);
    const password = passwordInput.value;

    if (!name || !email || !password) {
      setMessage("Please fill in all fields.");
      return;
    }

    if (password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }

    const users = readUsers();
    if (users.some((user) => user.email === email)) {
      setMessage("An account with this email already exists.");
      return;
    }

    users.push({ name, email, password });
    writeUsers(users);
    localStorage.setItem(SESSION_KEY, JSON.stringify({ name, email }));
    setMessage("Account created. Redirecting...", true);
    window.setTimeout(() => {
      window.location.href = "index.html";
    }, 500);
  }

  function login() {
    const emailInput = document.getElementById("loginEmail");
    const passwordInput = document.getElementById("loginPassword");
    if (!emailInput || !passwordInput) return;

    const email = normalizeEmail(emailInput.value);
    const password = passwordInput.value;
    if (!email || !password) {
      setMessage("Please enter email and password.");
      return;
    }

    const users = readUsers();
    const user = users.find((entry) => entry.email === email && entry.password === password);
    if (!user) {
      setMessage("Invalid email or password.");
      return;
    }

    localStorage.setItem(SESSION_KEY, JSON.stringify({ name: user.name, email: user.email }));
    setMessage("Logged in. Redirecting...", true);
    window.setTimeout(() => {
      window.location.href = "index.html";
    }, 350);
  }

  function protectAuthPages() {
    const session = localStorage.getItem(SESSION_KEY);
    const isAuthPage = window.location.pathname.endsWith("/login.html")
      || window.location.pathname.endsWith("/signup.html")
      || window.location.pathname.endsWith("login.html")
      || window.location.pathname.endsWith("signup.html");
    if (session && isAuthPage) {
      window.location.href = "index.html";
    }
  }

  protectAuthPages();

  const signupBtn = document.getElementById("signupBtn");
  if (signupBtn) {
    signupBtn.addEventListener("click", createAccount);
  }

  const loginBtn = document.getElementById("loginBtn");
  if (loginBtn) {
    loginBtn.addEventListener("click", login);
  }
})();
