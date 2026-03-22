(function () {
  const SESSION_KEY = "nextact_current_user";

  function setMessage(text, isSuccess) {
    const message = document.getElementById("authMessage");
    if (!message) return;
    message.textContent = text || "";
    message.className = isSuccess ? "message success" : "message";
  }

  function normalizeEmail(email) {
    return email.trim().toLowerCase();
  }

  async function createAccount() {
    const nameInput = document.getElementById("signupName");
    const emailInput = document.getElementById("signupEmail");
    const passwordInput = document.getElementById("signupPassword");
    if (!nameInput || !emailInput || !passwordInput) return;

    const full_name = nameInput.value.trim();
    const email = normalizeEmail(emailInput.value);
    const password = passwordInput.value;

    if (!full_name || !email || !password) {
      setMessage("Please fill in all fields.");
      return;
    }

    if (password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }

    try {
      const result = await signup({ full_name, email, password });

      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          id: result.user.id,
          name: result.user.full_name,
          email: result.user.email,
          token: result.token || ""
        })
      );

      setMessage("Account created. Redirecting...", true);
      window.setTimeout(() => {
        window.location.href = "index.html";
      }, 500);
    } catch (error) {
      setMessage(error.message || "Signup failed.");
    }
  }

  async function doLogin() {
    const emailInput = document.getElementById("loginEmail");
    const passwordInput = document.getElementById("loginPassword");
    if (!emailInput || !passwordInput) return;

    const email = normalizeEmail(emailInput.value);
    const password = passwordInput.value;

    if (!email || !password) {
      setMessage("Please enter email and password.");
      return;
    }

    try {
      const result = await login({ email, password });

      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          id: result.user.id,
          name: result.user.full_name,
          email: result.user.email,
          token: result.token || ""
        })
      );

      setMessage("Logged in. Redirecting...", true);
      window.setTimeout(() => {
        window.location.href = "index.html";
      }, 350);
    } catch (error) {
      setMessage(error.message || "Invalid email or password.");
    }
  }

  function protectAuthPages() {
    const session = localStorage.getItem(SESSION_KEY);
    const isAuthPage =
      window.location.pathname.endsWith("/login.html") ||
      window.location.pathname.endsWith("/signup.html") ||
      window.location.pathname.endsWith("login.html") ||
      window.location.pathname.endsWith("signup.html");

    if (session && isAuthPage) {
      window.location.href = "index.html";
    }
  }

  protectAuthPages();

  const signupBtn = document.getElementById("signupBtn");
  if (signupBtn) signupBtn.addEventListener("click", createAccount);

  const loginBtn = document.getElementById("loginBtn");
  if (loginBtn) loginBtn.addEventListener("click", doLogin);
})();