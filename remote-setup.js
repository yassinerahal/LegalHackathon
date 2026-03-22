(function () {
  const setupEmailText = document.getElementById("setupEmailText");
  const passwordInput = document.getElementById("remoteSetupPassword");
  const confirmInput = document.getElementById("remoteSetupPasswordConfirm");
  const activateButton = document.getElementById("completeRemoteSetupBtn");

  function setMessage(text, isSuccess) {
    const message = document.getElementById("authMessage");
    if (!message) return;
    message.textContent = text || "";
    message.className = isSuccess ? "message success" : "message";
  }

  function getTokenFromQuery() {
    const params = new URLSearchParams(window.location.search);
    return params.get("token");
  }

  async function loadInvitation() {
    const token = getTokenFromQuery();
    if (!token) {
      setupEmailText.textContent = "This invitation link is invalid or incomplete.";
      activateButton.disabled = true;
      return;
    }

    try {
      const result = await getRemoteSetupInfo(token);
      setupEmailText.textContent = `Set a password for ${result.client.email}. This link can only be used once.`;
    } catch (error) {
      setupEmailText.textContent = error.message || "This invitation link is invalid or expired.";
      activateButton.disabled = true;
    }
  }

  async function completeSetup() {
    const token = getTokenFromQuery();
    if (!token) {
      setMessage("This invitation link is invalid or expired.");
      return;
    }

    const password = passwordInput.value;
    const confirm = confirmInput.value;

    if (!password || !confirm) {
      setMessage("Please complete both password fields.");
      return;
    }

    if (password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirm) {
      setMessage("Passwords do not match.");
      return;
    }

    try {
      await completeRemoteSetup({ token, password });
      setMessage("Remote access activated. Redirecting to login...", true);
      window.setTimeout(() => {
        window.location.href = "login.html";
      }, 900);
    } catch (error) {
      setMessage(error.message || "Failed to activate remote access.");
    }
  }

  activateButton.addEventListener("click", completeSetup);
  loadInvitation();
})();
