(function () {
  const AUTH_SESSION_KEY = "nextact_current_user";

  function setMessage(text, isSuccess) {
    const message = document.getElementById("authMessage");
    if (!message) return;
    message.textContent = text || "";
    message.className = isSuccess ? "message success" : "message";
  }

  function normalizeEmail(email) {
    return email.trim().toLowerCase();
  }

  function persistSession(result) {
    localStorage.setItem(
      AUTH_SESSION_KEY,
      JSON.stringify({
        id: result.user.id,
        username: result.user.username || result.user.full_name || "",
        name: result.user.full_name || result.user.username || "",
        email: result.user.email || "",
        role: result.user.role || "pending",
        isApproved: Boolean(result.user.is_approved),
        clientId: result.user.client_id || null,
        token: result.token || ""
      })
    );
  }

  function prefillRemoteUserEmail() {
    const emailInput = document.getElementById("loginEmail");
    if (!emailInput) return;

    const params = new URLSearchParams(window.location.search);
    const email = params.get("email");
    if (email) {
      emailInput.value = email;
    }
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

    if (password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }

    try {
      const result = await signup({ full_name, email, password });
      clearStoredSession();
      setMessage(result.message || "Registration submitted. Waiting for Admin Approval.", true);
      window.setTimeout(() => {
        window.location.href = "login.html";
      }, 900);
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
      const result = await login({ identifier: email, password });
      persistSession(result);
      setMessage("Logged in. Redirecting...", true);
      window.setTimeout(() => {
        window.location.href = getSessionHomePath(getStoredSession());
      }, 350);
    } catch (error) {
      setMessage(error.message || "Invalid email or password.");
    }
  }

  function protectAuthPages() {
    const session = getStoredSession();
    const isAuthPage =
      window.location.pathname.endsWith("/login.html") ||
      window.location.pathname.endsWith("/signup.html") ||
      window.location.pathname.endsWith("login.html") ||
      window.location.pathname.endsWith("signup.html");

    if (session && isAuthPage) {
      window.location.href = getSessionHomePath(session);
    }
  }

  protectAuthPages();
  prefillRemoteUserEmail();

  const signupBtn = document.getElementById("signupBtn");
  if (signupBtn) signupBtn.addEventListener("click", createAccount);

  const loginBtn = document.getElementById("loginBtn");
  if (loginBtn) loginBtn.addEventListener("click", doLogin);
})();
