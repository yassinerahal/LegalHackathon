const cors = require("cors");
const crypto = require("crypto");
const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const { GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const { bucketName, ensureStorageReady, initStorage, s3Client } = require("./s3");
let QRCode = null;
const prisma = require("./prisma");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const REMOTE_ACCESS_EXPIRY_HOURS = Number(process.env.REMOTE_ACCESS_EXPIRY_HOURS || 48);
const BOOTSTRAP_ADMIN_USERNAME = process.env.BOOTSTRAP_ADMIN_USERNAME || "admin";
const BOOTSTRAP_ADMIN_EMAIL = (process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@nextact.local").trim().toLowerCase();
const BOOTSTRAP_ADMIN_PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD || "Admin123!";

app.use(cors());
app.use(express.json());

async function caseExists(caseId) {
  const entry = await prisma.case.findUnique({
    where: { id: Number(caseId) },
    select: { id: true }
  });
  return Boolean(entry);
}

async function placeholderBelongsToCase(caseId, placeholderId) {
  const entry = await prisma.casePlaceholder.findFirst({
    where: {
      id: Number(placeholderId),
      case_id: Number(caseId)
    },
    select: { id: true }
  });
  return Boolean(entry);
}

// ---------------------------------------------------------
// MULTER CONFIGURATION FOR S3 UPLOADS
// ---------------------------------------------------------
const upload = multer({ storage: multer.memoryStorage() });
app.use(express.static(path.join(__dirname, "..")));

app.get("/remote-setup.html", (req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>NEXTACT - Remote Access Setup</title>
    <style>
      :root {
        --bg: #edf2fb;
        --card: rgba(255, 255, 255, 0.82);
        --card-strong: rgba(255, 255, 255, 0.94);
        --text: #182133;
        --muted: #5d6a82;
        --line: rgba(129, 146, 181, 0.24);
        --primary: #3457d5;
        --primary-dark: #2545b7;
        --shadow: 0 28px 64px rgba(24, 35, 67, 0.14);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background:
          linear-gradient(180deg, rgba(14, 24, 48, 0.18), rgba(14, 24, 48, 0.52)),
          url("https://images.unsplash.com/photo-1505664194779-8beaceb93744?auto=format&fit=crop&w=1800&q=80") center/cover fixed no-repeat,
          linear-gradient(150deg, #f8faff, #eef3ff);
        color: var(--text);
        line-height: 1.45;
      }
      body::before {
        content: "";
        position: fixed;
        inset: 0;
        background:
          radial-gradient(circle at top left, rgba(255, 255, 255, 0.34), transparent 24%),
          radial-gradient(circle at bottom right, rgba(52, 87, 213, 0.18), transparent 28%);
        pointer-events: none;
      }
      main { min-height: 100vh; display: grid; place-items: center; padding: 1.25rem; }
      .card {
        width: min(430px, 100%);
        background: var(--card);
        border: 1px solid var(--line);
        border-radius: 28px;
        padding: 1.5rem;
        display: grid;
        gap: 0.62rem;
        box-shadow: var(--shadow);
        backdrop-filter: blur(18px);
        position: relative;
        z-index: 1;
      }
      .logo {
        width: 5.25rem;
        height: 5.25rem;
        object-fit: contain;
        border-radius: 24px;
        background: rgba(255, 255, 255, 0.92);
        border: 1px solid var(--line);
        padding: 0.34rem;
        box-shadow: 0 14px 28px rgba(37, 69, 183, 0.12);
      }
      .back-link {
        color: var(--primary);
        text-decoration: none;
        font-size: 0.88rem;
        font-weight: 600;
      }
      h1 { margin: 0; font-size: 1.8rem; }
      p { color: var(--muted); line-height: 1.5; margin: 0; }
      label { display: block; font-size: 0.92rem; font-weight: 600; margin-top: 0.2rem; }
      input {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid var(--line);
        border-radius: 14px;
        padding: 0.86rem 0.92rem;
        background: var(--card-strong);
        color: var(--text);
        font: inherit;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5);
      }
      button {
        margin-top: 0.25rem;
        width: 100%;
        border: 0;
        border-radius: 14px;
        background: linear-gradient(180deg, #4164e1, var(--primary-dark));
        color: #fff;
        padding: 0.84rem 1rem;
        cursor: pointer;
        font: inherit;
        font-weight: 600;
        min-height: 44px;
        box-shadow: 0 14px 28px rgba(37, 69, 183, 0.24);
      }
      button:disabled { opacity: 0.55; cursor: not-allowed; }
      .message { min-height: 1.1rem; margin: 0.15rem 0 0; font-size: 0.85rem; color: #b0303f; }
      .message.success { color: #0d7a4a; }
      .muted { margin: 0 0 0.25rem; font-size: 0.9rem; }
      .gtranslate_wrapper {
        justify-self: end;
        display: inline-flex;
        align-items: center;
        margin-bottom: 0.25rem;
      }
      .gtranslate_wrapper .gt_selector {
        min-height: 40px;
        padding: 0.72rem 2.2rem 0.72rem 0.85rem;
        border: 1px solid var(--line);
        border-radius: 14px;
        background: var(--card-strong);
        color: var(--text);
        font: inherit;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5);
      }
    </style>
  </head>
  <body>
    <main>
      <section class="card">
        <div class="gtranslate_wrapper"></div>
        <img src="/icons/logo.png" alt="NEXTACT logo" class="logo" />
        <a href="/home.html" class="back-link">← Back to homepage</a>
        <h1>Set Up Your Remote Access</h1>
        <p id="setupEmailText" class="muted">Validating your invitation link...</p>
        <label for="password">Password</label>
        <input id="password" type="password" placeholder="At least 8 characters" />
        <label for="confirmPassword">Confirm Password</label>
        <input id="confirmPassword" type="password" placeholder="Repeat your password" />
        <p id="message" class="message"></p>
        <button id="activateBtn" type="button">Activate Access</button>
      </section>
    </main>
    <script>
      const setupEmailText = document.getElementById("setupEmailText");
      const passwordInput = document.getElementById("password");
      const confirmInput = document.getElementById("confirmPassword");
      const message = document.getElementById("message");
      const activateBtn = document.getElementById("activateBtn");

      function setMessage(text, ok) {
        message.textContent = text || "";
        message.className = ok ? "message success" : "message";
      }

      function getToken() {
        const params = new URLSearchParams(window.location.search);
        return params.get("token");
      }

      async function loadInvitation() {
        const token = getToken();
        if (!token) {
          setupEmailText.textContent = "This invitation link is invalid or incomplete.";
          activateBtn.disabled = true;
          return;
        }

        try {
          const response = await fetch("/api/remote-access/setup?token=" + encodeURIComponent(token));
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Failed to load invitation.");
          setupEmailText.textContent = "Set a password for " + data.client.email + ". This link can only be used once.";
        } catch (error) {
          setupEmailText.textContent = error.message || "This invitation link is invalid or expired.";
          activateBtn.disabled = true;
        }
      }

      async function completeSetup() {
        const token = getToken();
        const password = passwordInput.value;
        const confirm = confirmInput.value;

        if (!token) {
          setMessage("This invitation link is invalid or expired.");
          return;
        }
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
          const response = await fetch("/api/remote-access/setup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, password })
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Failed to activate remote access.");
          setMessage("Remote access activated. You can now log in with your email.", true);
        } catch (error) {
          setMessage(error.message || "Failed to activate remote access.");
        }
      }

      activateBtn.addEventListener("click", completeSetup);
      loadInvitation();
    </script>
    <script>
      window.gtranslateSettings = {
        default_language: "en",
        languages: ["en", "de"],
        wrapper_selector: ".gtranslate_wrapper",
        flag_style: "2d",
        alt_flags: { en: "usa" }
      };
    </script>
    <script src="https://cdn.gtranslate.net/widgets/latest/dropdown.js" defer></script>
  </body>
</html>`);
});

app.get("/remote-portal.html", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "remote-portal.html"));
});

function signAuthToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "1d" });
}

function hashSetupToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function buildSetupLink(req, token) {
  return `${req.protocol}://${req.get("host")}/remote-setup.html?token=${encodeURIComponent(token)}`;
}

async function buildQrCodeDataUrl(value) {
  if (!QRCode) {
    try {
      // Keep QR generation optional so a missing package never takes down the whole API.
      QRCode = require("qrcode");
    } catch (error) {
      console.warn("QR code package not available, continuing without QR output.");
      return null;
    }
  }

  return QRCode.toDataURL(value, {
    width: 240,
    margin: 1
  });
}

function normalizeUserRole(role) {
  if (role === "staff") return "lawyer";
  if (role === "remote_user") return "client";
  return role || "pending";
}

function buildAuthUser(user) {
  const role = normalizeUserRole(user.role);
  return {
    id: user.id,
    username: user.username || user.full_name || "",
    full_name: user.full_name || user.username || "",
    email: user.email,
    role,
    is_approved: Boolean(user.is_approved ?? role !== "pending"),
    client_id: user.client_id || null
  };
}

function formatDateOnly(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

async function ensureRemoteAccessSchema() {
  await prisma.$connect();
}

async function ensureBootstrapAdmin() {
  const existingAdmin = await prisma.user.findFirst({
    where: { role: "admin" },
    select: { id: true }
  });

  if (existingAdmin) {
    return;
  }

  const passwordHash = await bcrypt.hash(BOOTSTRAP_ADMIN_PASSWORD, 10);
  await prisma.user.upsert({
    where: { email: BOOTSTRAP_ADMIN_EMAIL },
    update: {
      username: BOOTSTRAP_ADMIN_USERNAME,
      full_name: BOOTSTRAP_ADMIN_USERNAME,
      password_hash: passwordHash,
      role: "admin",
      is_approved: true
    },
    create: {
      username: BOOTSTRAP_ADMIN_USERNAME,
      full_name: BOOTSTRAP_ADMIN_USERNAME,
      email: BOOTSTRAP_ADMIN_EMAIL,
      password_hash: passwordHash,
      role: "admin",
      is_approved: true
    }
  });

  console.log(`Bootstrap admin ready: ${BOOTSTRAP_ADMIN_EMAIL}`);
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization || "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
}

function requireAuth(req, res, next) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    req.auth = jwt.verify(token, JWT_SECRET);
    if (!req.auth.is_approved || req.auth.role === "pending") {
      return res.status(403).json({ error: "Waiting for Admin Approval" });
    }
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}

function requireRole(roles) {
  return (req, res, next) =>
    requireAuth(req, res, () => {
      if (!roles.includes(req.auth.role)) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      return next();
    });
}

const requireStaffAuth = requireRole(["admin", "lawyer", "assistant"]);

async function getCaseAccessRow(caseId, userId) {
  const entry = await prisma.case.findUnique({
    where: { id: Number(caseId) },
    select: {
      id: true,
      owner_id: true,
      case_assignments: {
        where: { user_id: Number(userId) },
        select: { id: true }
      }
    }
  });

  if (!entry) {
    return null;
  }

  return {
    id: entry.id,
    owner_id: entry.owner_id,
    is_assigned: entry.case_assignments.length > 0
  };
}

function requireCaseEditAccess(req, res, next) {
  return requireStaffAuth(req, res, async () => {
    try {
      const caseAccess = await getCaseAccessRow(req.params.id, req.auth.id);
      if (!caseAccess) {
        return res.status(404).json({ error: "Case not found" });
      }

      const isOwner = String(caseAccess.owner_id || "") === String(req.auth.id);
      const isAssigned = Boolean(caseAccess.is_assigned);
      const canEdit =
        req.auth.role === "admin" ||
        (req.auth.role === "lawyer" && (isOwner || isAssigned)) ||
        (req.auth.role === "assistant" && isAssigned);

      if (!canEdit) {
        return res.status(403).json({ error: "You do not have edit access to this case" });
      }

      req.caseAccess = { ...caseAccess, isOwner, isAssigned, canEdit };
      return next();
    } catch (error) {
      console.error("Case access check failed:", error);
      return res.status(500).json({ error: "Failed to verify case access" });
    }
  });
}

function requireCaseOwnerOrAdmin(req, res, next) {
  return requireStaffAuth(req, res, async () => {
    try {
      const caseAccess = await getCaseAccessRow(req.params.id, req.auth.id);
      if (!caseAccess) {
        return res.status(404).json({ error: "Case not found" });
      }

      const isOwner = String(caseAccess.owner_id || "") === String(req.auth.id);
      if (req.auth.role !== "admin" && !isOwner) {
        return res.status(403).json({ error: "Only the case owner or an admin can do this" });
      }

      req.caseAccess = { ...caseAccess, isOwner, isAssigned: Boolean(caseAccess.is_assigned) };
      return next();
    } catch (error) {
      console.error("Case ownership check failed:", error);
      return res.status(500).json({ error: "Failed to verify case ownership" });
    }
  });
}

function requireRemoteUserAuth(req, res, next) {
  return requireAuth(req, res, () => {
    // Backend enforcement: remote users are always scoped to their linked client record.
    if (req.auth.role !== "client" || !req.auth.client_id) {
      return res.status(403).json({ error: "Remote user access only" });
    }
    return next();
  });
}

async function getActiveRemoteAccessInvite(token) {
  const tokenHash = hashSetupToken(token);
  return prisma.remoteAccessToken.findFirst({
    where: {
      token_hash: tokenHash,
      status: "active",
      expires_at: { gt: new Date() }
    },
    include: { client: true }
  }).then((entry) => {
    if (!entry) return null;
    return {
      id: entry.id,
      client_id: entry.client_id,
      status: entry.status,
      expires_at: entry.expires_at,
      full_name: entry.client.full_name,
      email: entry.client.email,
      address: entry.client.address,
      phone: entry.client.phone,
      zip_code: entry.client.zip_code,
      city: entry.client.city,
      state: entry.client.state
    };
  });
}

// Health check
app.get("/api/health", async (req, res) => {
  try {
    await prisma.$connect();
    res.json({ ok: true, time: new Date().toISOString() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Database connection failed" });
  }
});

// ---------------------------------------------------------
// FILE UPLOAD ROUTE (LOCALSTACK S3)
// ---------------------------------------------------------
app.post("/api/upload", requireStaffAuth, upload.single("document"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    await ensureStorageReady();

    const uniqueFileName = `${Date.now()}-${file.originalname}`;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: uniqueFileName,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    await s3Client.send(command);

    res.status(200).json({
      message: "File uploaded successfully",
      filePath: uniqueFileName
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({
      error: `Failed to upload file to S3: ${error.name || "UnknownError"}${error.message ? ` - ${error.message}` : ""}`
    });
  }
});

// Save document metadata to PostgreSQL
app.post("/api/cases/:id/documents", requireCaseEditAccess, async (req, res) => {
  try {
    const caseId = req.params.id;
    const { original_name, s3_key, mime_type } = req.body;

    if (!original_name || !s3_key) {
      return res.status(400).json({ error: "original_name and s3_key are required" });
    }

    if (!(await caseExists(caseId))) {
      return res.status(404).json({ error: "Case not found" });
    }

    const createdVersion = await prisma.$transaction(async (tx) => {
      const document = await tx.document.create({
        data: {
          case_id: Number(caseId),
          name: original_name
        }
      });

      return tx.documentVersion.create({
        data: {
          document_id: document.id,
          original_name,
          s3_key,
          mime_type: mime_type || null,
          uploaded_by: req.auth.id
        }
      });
    });

    res.status(201).json({
      id: createdVersion.id,
      case_id: Number(caseId),
      original_name: createdVersion.original_name,
      s3_key: createdVersion.s3_key,
      mime_type: createdVersion.mime_type,
      uploaded_at: createdVersion.uploaded_at
    });
  } catch (error) {
    console.error("Database insert error:", error);
    res.status(500).json({ error: "Failed to save document info to database" });
  }
});

app.get("/api/cases/:id/documents", requireStaffAuth, async (req, res) => {
  try {
    const caseId = req.params.id;

    if (!/^\d+$/.test(String(caseId))) {
      return res.status(400).json({ error: "Invalid case id" });
    }

    if (!(await caseExists(caseId))) {
      return res.status(404).json({ error: "Case not found" });
    }

    const versions = await prisma.documentVersion.findMany({
      where: {
        document: {
          case_id: Number(caseId)
        }
      },
      include: {
        document: {
          select: { case_id: true }
        }
      },
      orderBy: [{ uploaded_at: "desc" }, { id: "desc" }]
    });

    res.json(
      versions.map((version) => ({
        id: version.id,
        case_id: version.document.case_id,
        original_name: version.original_name,
        s3_key: version.s3_key,
        mime_type: version.mime_type,
        uploaded_at: version.uploaded_at
      }))
    );
  } catch (error) {
    console.error("Fetch case documents error:", error);
    res.status(500).json({ error: "Failed to fetch case documents" });
  }
});

app.get("/api/documents/:s3Key/download", requireStaffAuth, async (req, res) => {
  try {
    const s3Key = String(req.params.s3Key || "").trim();
    if (!s3Key) {
      return res.status(400).json({ error: "Invalid document key" });
    }

    const requestedName = typeof req.query.name === "string" ? req.query.name.trim() : "";
    const documentVersion = await prisma.documentVersion.findUnique({
      where: { s3_key: s3Key },
      select: { original_name: true, mime_type: true }
    });

    if (!documentVersion) {
      return res.status(404).json({ error: "Document not found" });
    }

    await ensureStorageReady();
    const objectResponse = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: s3Key
      })
    );

    const originalName = requestedName || documentVersion.original_name || s3Key;
    const safeFileName = path.basename(originalName).replace(/"/g, "");

    res.setHeader(
      "Content-Type",
      objectResponse.ContentType || documentVersion.mime_type || "application/octet-stream"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${safeFileName}"`);

    if (objectResponse.Body && typeof objectResponse.Body.pipe === "function") {
      objectResponse.Body.on("error", (error) => {
        console.error("S3 download stream error:", error);
        if (!res.headersSent) {
          res.status(500).end("Failed to stream document");
        } else {
          res.destroy(error);
        }
      });
      objectResponse.Body.pipe(res);
      return;
    }

    if (objectResponse.Body && typeof objectResponse.Body.transformToByteArray === "function") {
      const bodyBytes = await objectResponse.Body.transformToByteArray();
      res.send(Buffer.from(bodyBytes));
      return;
    }

    res.status(500).json({ error: "Document stream unavailable" });
  } catch (error) {
    console.error("Document download error:", error);
    res.status(500).json({ error: "Failed to download document" });
  }
});

app.post("/api/cases/:id/placeholders", requireCaseEditAccess, async (req, res) => {
  try {
    const caseId = req.params.id;
    const placeholders = Array.isArray(req.body) ? req.body : [];

    if (!/^\d+$/.test(String(caseId))) {
      return res.status(400).json({ error: "Invalid case id" });
    }

    if (!(await caseExists(caseId))) {
      return res.status(404).json({ error: "Case not found" });
    }

    if (!placeholders.length) {
      return res.status(400).json({ error: "At least one placeholder is required" });
    }

    if (placeholders.some((placeholder) => !String(placeholder.name || "").trim())) {
      return res.status(400).json({ error: "Each placeholder requires a name" });
    }

    const created = await prisma.$transaction(
      placeholders.map((placeholder) =>
        prisma.casePlaceholder.create({
          data: {
            case_id: Number(caseId),
            name: String(placeholder.name || "").trim(),
            status: String(placeholder.status || "Pending"),
            attached_files: Array.isArray(placeholder.attached_files) ? placeholder.attached_files : []
          }
        })
      )
    );

    res.status(201).json(created);
  } catch (error) {
    console.error("Create placeholders error:", error);
    res.status(500).json({ error: "Failed to create placeholders" });
  }
});

app.get("/api/cases/:id/placeholders", requireStaffAuth, async (req, res) => {
  try {
    const caseId = req.params.id;

    if (!/^\d+$/.test(String(caseId))) {
      return res.status(400).json({ error: "Invalid case id" });
    }

    if (!(await caseExists(caseId))) {
      return res.status(404).json({ error: "Case not found" });
    }

    const placeholders = await prisma.casePlaceholder.findMany({
      where: { case_id: Number(caseId) },
      orderBy: [{ created_at: "asc" }, { id: "asc" }]
    });

    res.json(placeholders);
  } catch (error) {
    console.error("Fetch placeholders error:", error);
    res.status(500).json({ error: "Failed to fetch placeholders" });
  }
});

app.put("/api/cases/:id/placeholders/:placeholderId/link", requireCaseEditAccess, async (req, res) => {
  try {
    const caseId = req.params.id;
    const placeholderId = req.params.placeholderId;
    const { original_name, s3_key, mime_type } = req.body;

    if (!/^\d+$/.test(String(caseId)) || !/^\d+$/.test(String(placeholderId))) {
      return res.status(400).json({ error: "Invalid case or placeholder id" });
    }

    if (!original_name || !s3_key) {
      return res.status(400).json({ error: "original_name and s3_key are required" });
    }

    if (!(await caseExists(caseId))) {
      return res.status(404).json({ error: "Case not found" });
    }

    if (!(await placeholderBelongsToCase(caseId, placeholderId))) {
      return res.status(404).json({ error: "Placeholder not found for this case" });
    }

    const documentVersion = await prisma.documentVersion.findFirst({
      where: {
        s3_key,
        document: {
          case_id: Number(caseId)
        }
      },
      select: { id: true }
    });

    if (!documentVersion) {
      return res.status(404).json({ error: "Document not found for this case" });
    }

    const placeholder = await prisma.casePlaceholder.findFirst({
      where: {
        id: Number(placeholderId),
        case_id: Number(caseId)
      }
    });

    if (!placeholder) {
      return res.status(404).json({ error: "Placeholder not found for this case" });
    }

    const attachedFiles = Array.isArray(placeholder.attached_files) ? placeholder.attached_files : [];
    attachedFiles.push({
      original_name,
      s3_key,
      mime_type: mime_type || null
    });

    const updatedPlaceholder = await prisma.casePlaceholder.update({
      where: { id: Number(placeholderId) },
      data: {
        status: "Uploaded",
        attached_files: attachedFiles
      }
    });

    res.json(updatedPlaceholder);
  } catch (error) {
    console.error("Link placeholder error:", error);
    res.status(500).json({ error: "Failed to link placeholder" });
  }
});

app.get("/api/clients", requireStaffAuth, async (req, res) => {
  try {
    const clients = await prisma.client.findMany({
      orderBy: { created_at: "desc" }
    });
    res.json(clients);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch clients" });
  }
});

app.get("/api/clients/:id", requireStaffAuth, async (req, res) => {
  try {
    const client = await prisma.client.findUnique({
      where: { id: Number(req.params.id) }
    });

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    res.json(client);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch client" });
  }
});

app.put("/api/clients/:id", requireStaffAuth, async (req, res) => {
  try {
    const { full_name, email, phone, address, zip_code, city, state } = req.body;

    const client = await prisma.client.update({
      where: { id: Number(req.params.id) },
      data: { full_name, email, phone, address, zip_code, city, state }
    }).catch(() => null);

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    res.json(client);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update client" });
  }
});

app.delete("/api/clients/:id", requireStaffAuth, async (req, res) => {
  try {
    const deleted = await prisma.client.delete({
      where: { id: Number(req.params.id) }
    }).catch(() => null);

    if (!deleted) {
      return res.status(404).json({ error: "Client not found" });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "Failed to delete client" });
  }
});

app.post("/api/clients/:id/remote-access", requireStaffAuth, async (req, res) => {
  try {
    const client = await prisma.client.findUnique({
      where: { id: Number(req.params.id) },
      select: { id: true, full_name: true, email: true }
    });

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    if (!client.email) {
      return res.status(400).json({
        error: "Remote access can only be granted to clients with an email address."
      });
    }

    const conflictingAccount = await prisma.user.findFirst({
      where: {
        email: { equals: client.email.trim().toLowerCase(), mode: "insensitive" },
        NOT: {
          AND: [{ role: "client" }, { client_id: client.id }]
        }
      },
      select: { id: true }
    });

    if (conflictingAccount) {
      return res.status(409).json({
        error: "That email address is already used by another account."
      });
    }

    await prisma.remoteAccessToken.updateMany({
      where: { client_id: client.id, status: "active" },
      data: { status: "expired" }
    });

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashSetupToken(rawToken);

    const expiresAt = new Date(Date.now() + REMOTE_ACCESS_EXPIRY_HOURS * 60 * 60 * 1000);
    const tokenResult = await prisma.remoteAccessToken.create({
      data: {
        client_id: client.id,
        token_hash: tokenHash,
        status: "active",
        expires_at: expiresAt
      }
    });

    const setupLink = buildSetupLink(req, rawToken);
    const qrCodeDataUrl = await buildQrCodeDataUrl(setupLink);

    res.json({
      setup_link: setupLink,
      qr_code_data_url: qrCodeDataUrl,
      expires_at: tokenResult.expires_at,
      client: {
        id: client.id,
        full_name: client.full_name,
        email: client.email
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to grant remote access" });
  }
});

app.get("/api/clients/:id/cases", requireStaffAuth, async (req, res) => {
  try {
    const cases = await prisma.case.findMany({
      where: { client_id: Number(req.params.id) },
      orderBy: { created_at: "desc" }
    });

    res.json(cases.map((entry) => ({ ...entry, deadline: formatDateOnly(entry.deadline) })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch client cases" });
  }
});

app.post("/api/clients", requireStaffAuth, async (req, res) => {
  try {
    const { full_name, email, phone, address, zip_code, city, state } = req.body;

    const client = await prisma.client.create({
      data: { full_name, email, phone, address, zip_code, city, state }
    });

    res.status(201).json(client);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create client" });
  }
});

app.get("/api/cases", requireStaffAuth, async (req, res) => {
  try {
    const cases = await prisma.case.findMany({
      include: {
        client: { select: { full_name: true } },
        owner: { select: { username: true, full_name: true } },
        case_assignments: {
          where: { user_id: Number(req.auth.id) },
          select: { id: true }
        },
        documents: { select: { id: true } },
        case_placeholders: { select: { id: true } }
      },
      orderBy: { created_at: "desc" }
    });

    res.json(
      cases.map((entry) => {
        const isOwner = String(entry.owner_id || "") === String(req.auth.id);
        const isAssigned = entry.case_assignments.length > 0;
        const canEdit =
          req.auth.role === "admin" ||
          (req.auth.role === "lawyer" && (isOwner || isAssigned)) ||
          (req.auth.role === "assistant" && isAssigned);

        return {
          id: entry.id,
          name: entry.name,
          client_id: entry.client_id,
          owner_id: entry.owner_id,
          status: entry.status,
          deadline: formatDateOnly(entry.deadline),
          short_description: entry.short_description,
          created_at: entry.created_at,
          client_name: entry.client?.full_name || "",
          owner_username: entry.owner?.username || "",
          owner_full_name: entry.owner?.full_name || "",
          is_owner: isOwner,
          is_assigned: isAssigned,
          can_edit: canEdit
        };
      })
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "Failed to fetch cases" });
  }
});

app.get("/api/cases/:id", requireStaffAuth, async (req, res) => {
  try {
    const entry = await prisma.case.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        client: { select: { full_name: true } },
        owner: { select: { username: true, full_name: true } },
        case_assignments: {
          where: { user_id: Number(req.auth.id) },
          select: { id: true }
        },
        documents: { include: { document_versions: true } },
        case_placeholders: true
      }
    });

    if (!entry) {
      return res.status(404).json({ error: "Case not found" });
    }

    const isOwner = String(entry.owner_id || "") === String(req.auth.id);
    const isAssigned = entry.case_assignments.length > 0;
    const canEdit =
      req.auth.role === "admin" ||
      (req.auth.role === "lawyer" && (isOwner || isAssigned)) ||
      (req.auth.role === "assistant" && isAssigned);

    res.json({
      id: entry.id,
      name: entry.name,
      client_id: entry.client_id,
      owner_id: entry.owner_id,
      status: entry.status,
      deadline: formatDateOnly(entry.deadline),
      short_description: entry.short_description,
      created_at: entry.created_at,
      client_name: entry.client?.full_name || "",
      owner_username: entry.owner?.username || "",
      owner_full_name: entry.owner?.full_name || "",
      is_owner: isOwner,
      is_assigned: isAssigned,
      can_edit: canEdit
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch case" });
  }
});

app.put("/api/cases/:id", requireCaseEditAccess, async (req, res) => {
  try {
    const { name, client_id, status, deadline, short_description } = req.body;

    const updatedCase = await prisma.case.update({
      where: { id: Number(req.params.id) },
      data: {
        name,
        client_id: Number(client_id),
        status: status || "open",
        deadline: deadline ? new Date(deadline) : null,
        short_description: short_description || null
      }
    }).catch(() => null);

    if (!updatedCase) {
      return res.status(404).json({ error: "Case not found" });
    }

    res.json({
      ...updatedCase,
      deadline: formatDateOnly(updatedCase.deadline)
    });
  } catch (error) {
    console.error("Update case error:", error);
    res.status(500).json({ error: error.message || "Failed to update case" });
  }
});

app.delete("/api/cases/:id", requireCaseOwnerOrAdmin, async (req, res) => {
  try {
    const deleted = await prisma.case.delete({
      where: { id: Number(req.params.id) }
    }).catch(() => null);

    if (!deleted) {
      return res.status(404).json({ error: "Case not found" });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error("Delete case error:", error);
    res.status(500).json({ error: error.message || "Failed to delete case" });
  }
});

app.post("/api/cases", requireRole(["admin", "lawyer"]), async (req, res) => {
  try {
    const { name, client_id, status, deadline, short_description } = req.body;

    if (!name || !client_id) {
      return res.status(400).json({ error: "name and client_id are required" });
    }

    const createdCase = await prisma.case.create({
      data: {
        name,
        client_id: Number(client_id),
        owner_id: req.auth.id,
        status: status || "open",
        deadline: deadline ? new Date(deadline) : null,
        short_description: short_description || null
      }
    });

    res.status(201).json({
      ...createdCase,
      deadline: formatDateOnly(createdCase.deadline)
    });
  } catch (error) {
    console.error("Create case error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/cases/:id/assign", requireCaseOwnerOrAdmin, async (req, res) => {
  try {
    const userId = Number(req.body.user_id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: "user_id must be a valid number" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const targetUser = buildAuthUser(user);
    if (!targetUser.is_approved || !["admin", "lawyer", "assistant"].includes(targetUser.role)) {
      return res.status(400).json({ error: "Only approved firm users can be assigned to cases" });
    }

    const assignment = await prisma.caseAssignment.upsert({
      where: {
        case_id_user_id: {
          case_id: Number(req.params.id),
          user_id: userId
        }
      },
      update: {},
      create: {
        case_id: Number(req.params.id),
        user_id: userId
      }
    });

    res.status(201).json({
      assignment,
      user: targetUser
    });
  } catch (error) {
    console.error("Assign case user error:", error);
    res.status(500).json({ error: "Failed to assign user to case" });
  }
});

app.get("/api/cases/:id/assignments", requireStaffAuth, async (req, res) => {
  try {
    if (!(await caseExists(req.params.id))) {
      return res.status(404).json({ error: "Case not found" });
    }

    const assignments = await prisma.caseAssignment.findMany({
      where: { case_id: Number(req.params.id) },
      include: { user: true },
      orderBy: [{ user: { full_name: "asc" } }, { user: { username: "asc" } }, { id: "asc" }]
    });

    res.json(
      assignments.map((row) => ({
        ...buildAuthUser(row.user),
        assigned_at: row.created_at
      }))
    );
  } catch (error) {
    console.error("Fetch case assignments error:", error);
    res.status(500).json({ error: "Failed to fetch case assignments" });
  }
});

app.get("/api/remote-access/setup", async (req, res) => {
  try {
    const token = String(req.query.token || "");
    if (!token) {
      return res.status(400).json({ error: "Missing setup token." });
    }

    const invitation = await getActiveRemoteAccessInvite(token);
    if (!invitation) {
      return res.status(400).json({
        error: "This remote access link is invalid, expired, or already used."
      });
    }

    res.json({
      client: {
        full_name: invitation.full_name,
        email: invitation.email
      },
      expires_at: invitation.expires_at
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to load setup details" });
  }
});

app.post("/api/remote-access/setup", async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: "Token and password are required." });
    }

    if (String(password).length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    }

    const invitation = await prisma.remoteAccessToken.findFirst({
      where: {
        token_hash: hashSetupToken(token),
        status: "active",
        expires_at: { gt: new Date() }
      },
      include: { client: true }
    });

    if (!invitation) {
      return res.status(400).json({
        error: "This remote access link is invalid, expired, or already used."
      });
    }

    const email = invitation.client.email?.trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ error: "The linked client record is missing an email address." });
    }

    const conflictingUser = await prisma.user.findFirst({
      where: {
        email: { equals: email, mode: "insensitive" },
        NOT: {
          AND: [{ role: "client" }, { client_id: invitation.client_id }]
        }
      },
      select: { id: true }
    });

    if (conflictingUser) {
      return res.status(409).json({
        error: "That email address is already associated with another account."
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const existingRemoteUser = await prisma.user.findFirst({
      where: {
        role: "client",
        client_id: invitation.client_id
      },
      select: { id: true }
    });

    await prisma.$transaction(async (tx) => {
      if (existingRemoteUser) {
        await tx.user.update({
          where: { id: existingRemoteUser.id },
          data: {
            full_name: invitation.client.full_name,
            username: invitation.client.full_name,
            email,
            password_hash: passwordHash,
            role: "client",
            is_approved: true
          }
        });
      } else {
        await tx.user.create({
          data: {
            username: invitation.client.full_name,
            full_name: invitation.client.full_name,
            email,
            password_hash: passwordHash,
            role: "client",
            is_approved: true,
            client_id: invitation.client_id
          }
        });
      }

      await tx.remoteAccessToken.update({
        where: { id: invitation.id },
        data: {
          status: "used",
          used_at: new Date()
        }
      });

      await tx.remoteAccessToken.updateMany({
        where: {
          client_id: invitation.client_id,
          status: "active",
          NOT: { id: invitation.id }
        },
        data: { status: "expired" }
      });
    });

    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to complete remote access setup" });
  }
});

app.get("/api/remote-user/profile", requireRemoteUserAuth, async (req, res) => {
  try {
    const client = await prisma.client.findUnique({
      where: { id: Number(req.auth.client_id) },
      select: {
        id: true,
        full_name: true,
        email: true,
        phone: true,
        address: true,
        zip_code: true,
        city: true,
        state: true
      }
    });

    if (!client) {
      return res.status(404).json({ error: "Profile not found" });
    }

    res.json(client);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch remote user profile" });
  }
});

app.get("/api/remote-user/cases", requireRemoteUserAuth, async (req, res) => {
  try {
    const cases = await prisma.case.findMany({
      where: { client_id: Number(req.auth.client_id) },
      select: {
        id: true,
        name: true,
        status: true,
        deadline: true,
        short_description: true,
        created_at: true
      },
      orderBy: { created_at: "desc" }
    });

    res.json(cases.map((entry) => ({ ...entry, deadline: formatDateOnly(entry.deadline) })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch remote user cases" });
  }
});

app.get("/api/remote-user/timeline", requireRemoteUserAuth, async (req, res) => {
  try {
    const cases = await prisma.case.findMany({
      where: { client_id: Number(req.auth.client_id) },
      select: {
        id: true,
        name: true,
        deadline: true,
        short_description: true,
        created_at: true
      },
      orderBy: { created_at: "desc" }
    });

    const events = cases.flatMap((entry) => {
      const timeline = [
        {
          case_id: entry.id,
          case_name: entry.name,
          title: "Case opened",
          description: entry.short_description || "Case created in NEXTACT.",
          occurred_at: entry.created_at,
          kind: "created"
        }
      ];

      if (entry.deadline) {
        const deadlineValue = formatDateOnly(entry.deadline);
        timeline.push({
          case_id: entry.id,
          case_name: entry.name,
          title: "Deadline scheduled",
          description: `Deadline set for ${deadlineValue}`,
          occurred_at: `${deadlineValue}T00:00:00`,
          kind: "deadline"
        });
      }

      return timeline;
    });

    events.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
    res.json(events);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch remote user timeline" });
  }
});

app.get("/api/admin/users/pending", requireRole(["admin"]), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        OR: [{ is_approved: false }, { role: "pending" }]
      },
      orderBy: { created_at: "asc" }
    });

    res.json(users.map(buildAuthUser));
  } catch (error) {
    console.error("Fetch pending users error:", error);
    res.status(500).json({ error: "Failed to fetch pending users" });
  }
});

app.get("/api/admin/users", requireRole(["admin"]), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: [{ created_at: "desc" }, { id: "desc" }]
    });

    res.json(users.map(buildAuthUser));
  } catch (error) {
    console.error("Fetch users error:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

async function updateUserRole(req, res) {
  try {
    const nextRole = normalizeUserRole(String(req.body.role || "").trim().toLowerCase());
    if (!["admin", "lawyer", "assistant", "client"].includes(nextRole)) {
      return res.status(400).json({ error: "role must be admin, lawyer, assistant, or client" });
    }

    const user = await prisma.user.update({
      where: { id: Number(req.params.id) },
      data: {
        role: nextRole,
        is_approved: true
      }
    }).catch(() => null);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user: buildAuthUser(user) });
  } catch (error) {
    console.error("Update user role error:", error);
    res.status(500).json({ error: "Failed to update user role" });
  }
}

app.put("/api/admin/users/:id/approve", requireRole(["admin"]), updateUserRole);
app.put("/api/admin/users/:id/role", requireRole(["admin"]), updateUserRole);

app.get("/api/users/assignable", requireStaffAuth, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        is_approved: true,
        role: { in: ["admin", "lawyer", "assistant"] }
      },
      orderBy: [{ full_name: "asc" }, { username: "asc" }, { id: "asc" }]
    });

    res.json(users.map(buildAuthUser));
  } catch (error) {
    console.error("Fetch assignable users error:", error);
    res.status(500).json({ error: "Failed to fetch assignable users" });
  }
});

async function registerUser(req, res) {
  try {
    const username = String(req.body.username || req.body.full_name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!username || !email || !password) {
      return res.status(400).json({ error: "Username, email, and password are required." });
    }

    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true }
    });

    if (existingUser) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        username,
        full_name: username,
        email,
        password_hash: passwordHash,
        role: "pending",
        is_approved: false
      }
    });

    res.status(201).json({
      user: buildAuthUser(user),
      message: "Registration submitted. Waiting for Admin Approval."
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Registration failed." });
  }
}

app.post("/api/auth/register", registerUser);
app.post("/api/auth/signup", registerUser);

app.post("/api/auth/login", async (req, res) => {
  try {
    const identifier = String(req.body.identifier || req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!identifier || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const user = await prisma.user.findFirst({
      where: { email: { equals: identifier, mode: "insensitive" } }
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const authUser = buildAuthUser(user);
    if (!authUser.is_approved || authUser.role === "pending") {
      return res.status(403).json({ error: "Waiting for Admin Approval" });
    }

    const token = signAuthToken({
      id: authUser.id,
      email: authUser.email,
      role: authUser.role,
      is_approved: authUser.is_approved,
      client_id: authUser.client_id
    });

    res.json({
      user: authUser,
      token
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Login failed." });
  }
});

ensureRemoteAccessSchema()
  .then(() => ensureBootstrapAdmin())
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Backend running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to prepare backend schema", error);
    process.exit(1);
  });
