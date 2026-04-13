const cors = require("cors");
const crypto = require("crypto");
const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const { bucketName, ensureStorageReady, initStorage, s3Client } = require("./s3");
const { requireAuth, requireCaseEditAccess } = require("./middleware/auth");
const { seedDemoData } = require("./prisma/seed");
let QRCode = null;
const prisma = require("./prisma");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const FILE_ENCRYPTION_KEY_HEX = process.env.FILE_ENCRYPTION_KEY;
const REMOTE_ACCESS_EXPIRY_HOURS = Number(process.env.REMOTE_ACCESS_EXPIRY_HOURS || 48);
const BOOTSTRAP_ADMIN_USERNAME = process.env.BOOTSTRAP_ADMIN_USERNAME || "admin";
const BOOTSTRAP_ADMIN_EMAIL = (process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@nextact.local").trim().toLowerCase();
const BOOTSTRAP_ADMIN_PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD || "Admin123!";
const CASE_NUMBER_SETTING_KEY = "CASE_NUMBER_CONFIG";
const SEED_DEMO_DATA = String(process.env.SEED_DEMO_DATA || "false").toLowerCase() === "true";

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET must be set in the backend environment.");
}

if (!FILE_ENCRYPTION_KEY_HEX) {
  throw new Error("FILE_ENCRYPTION_KEY must be set in the backend environment.");
}

const FILE_ENCRYPTION_KEY = Buffer.from(FILE_ENCRYPTION_KEY_HEX, "hex");
const SUPPORTED_UPLOAD_EXTENSIONS = [
  ".pdf",
  ".xlsx",
  ".xls",
  ".png",
  ".jpg",
  ".jpeg",
  ".doc",
  ".docx",
  ".csv",
  ".txt"
];

if (FILE_ENCRYPTION_KEY.length !== 32) {
  throw new Error("FILE_ENCRYPTION_KEY must be a 32-byte hex string.");
}

app.use(cors());
app.use(express.json());

// ---------------------------------------------------------
// XML TEXT PARSER FOR ERV (ELEKTRONISCHER RECHTSVERKEHR) SOAP SERVICES
// ---------------------------------------------------------
// Parser for XML content types - must come BEFORE route handlers
app.use((req, res, next) => {
  const contentType = (req.get('Content-Type') || '').toLowerCase();
  console.log(`[PARSER] ${req.method} ${req.path} - Content-Type: "${contentType}"`);
  
  if (contentType.includes('xml')) {
    console.log(`[PARSER] Parsing XML body...`);
    let data = '';
    req.setEncoding('utf8');
    
    req.on('data', chunk => {
      console.log(`[PARSER] Received ${chunk.length} bytes`);
      data += chunk;
    });
    
    req.on('end', () => {
      console.log(`[PARSER] XML parsing complete, body size: ${data.length} bytes`);
      req.body = data;
      next();
    });
    
    req.on('error', (err) => {
      console.error(`[PARSER] Error reading body:`, err);
      res.status(400).send('Bad request');
    });
  } else {
    console.log(`[PARSER] Not XML, passing to next middleware`);
    next();
  }
});

// ---------------------------------------------------------
// ERV MOCK SERVICE ROUTES
// ---------------------------------------------------------
const ervMockRoutes = require("./routes/ervMock");
app.use("/services", ervMockRoutes);

function encryptFileBuffer(buffer) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", FILE_ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedBuffer: encrypted,
    encryptionIv: iv.toString("hex"),
    encryptionTag: authTag.toString("hex")
  };
}

function decryptFileBuffer(buffer, encryptionIv, encryptionTag) {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    FILE_ENCRYPTION_KEY,
    Buffer.from(encryptionIv, "hex")
  );
  decipher.setAuthTag(Buffer.from(encryptionTag, "hex"));
  return Buffer.concat([decipher.update(buffer), decipher.final()]);
}

function isSupportedUploadName(fileName = "") {
  const lowerFileName = String(fileName).toLowerCase();
  return SUPPORTED_UPLOAD_EXTENSIONS.some((extension) => lowerFileName.endsWith(extension));
}

async function readObjectBodyAsBuffer(body) {
  if (!body) {
    throw new Error("Document stream unavailable");
  }

  if (typeof body.transformToByteArray === "function") {
    const bytes = await body.transformToByteArray();
    return Buffer.from(bytes);
  }

  const chunks = [];
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

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

async function deleteStoredFileByKey(s3Key) {
  if (!s3Key) return;

  await ensureStorageReady();
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: s3Key
    })
  );
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

function normalizeCasePattern(pattern) {
  return String(pattern || "").trim();
}

function getInitials(value) {
  const normalized = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!normalized.length) {
    return "";
  }

  return normalized
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function generateCaseNumber(pattern, sequence, context = {}) {
  const now = new Date();
  const fullYear = String(now.getFullYear());
  const shortYear = fullYear.slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const rawSequence = String(sequence);
  const paddedSequence3 = String(sequence).padStart(3, "0");
  const paddedSequence4 = String(sequence).padStart(4, "0");

  return normalizeCasePattern(pattern)
    .replaceAll("[YYYY]", fullYear)
    .replaceAll("[YY]", shortYear)
    .replaceAll("[MM]", month)
    .replaceAll("[DD]", day)
    .replaceAll("[SEQ4]", paddedSequence4)
    .replaceAll("[SEQ3]", paddedSequence3)
    .replaceAll("[SEQ]", rawSequence)
    .replaceAll("[L_INIT]", context.lawyerInitials || "")
    .replaceAll("[C_INIT]", context.clientInitials || "");
}

async function ensureRemoteAccessSchema() {
  await prisma.$connect();
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS system_settings (
      id SERIAL PRIMARY KEY,
      setting_key VARCHAR(255) UNIQUE NOT NULL,
      pattern VARCHAR(255),
      current_sequence INTEGER DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE cases
    ADD COLUMN IF NOT EXISTS case_number VARCHAR(255)
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE document_versions
    ADD COLUMN IF NOT EXISTS placeholder_id INTEGER,
    ADD COLUMN IF NOT EXISTS encryption_iv VARCHAR(255),
    ADD COLUMN IF NOT EXISTS encryption_tag VARCHAR(255)
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS cases_case_number_key
    ON cases(case_number)
    WHERE case_number IS NOT NULL
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY,
      case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

function serializePlaceholder(placeholder) {
  const versions = Array.isArray(placeholder?.versions)
    ? [...placeholder.versions]
        .sort((left, right) => new Date(left.uploaded_at) - new Date(right.uploaded_at))
        .map((version) => ({
          id: version.id,
          placeholder_id: version.placeholder_id,
          original_name: version.original_name,
          s3_key: version.s3_key,
          mime_type: version.mime_type,
          encryption_iv: version.encryption_iv,
          encryption_tag: version.encryption_tag,
          uploaded_at: version.uploaded_at
        }))
    : [];

  return {
    id: placeholder.id,
    case_id: placeholder.case_id,
    name: placeholder.name,
    status: placeholder.status || (versions.length ? "Uploaded" : "Pending"),
    created_at: placeholder.created_at,
    versions,
    attached_files: versions.map((version) => ({
      original_name: version.original_name,
      s3_key: version.s3_key,
      mime_type: version.mime_type,
      encryption_iv: version.encryption_iv,
      encryption_tag: version.encryption_tag,
      uploaded_at: version.uploaded_at
    }))
  };
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

function buildCaseAccessFlags(entry, userId, role) {
  const isOwner = String(entry.owner_id || "") === String(userId);
  const isAssigned = Array.isArray(entry.case_assignments) ? entry.case_assignments.length > 0 : false;
  const canView =
    role === "admin" ||
    role === "lawyer" ||
    (role === "assistant" && isAssigned);
  const canEdit =
    role === "admin" ||
    (role === "lawyer" && (isOwner || isAssigned)) ||
    (role === "assistant" && isAssigned);

  return {
    isOwner,
    isAssigned,
    canView,
    canEdit
  };
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

    if (!isSupportedUploadName(file.originalname)) {
      return res.status(400).json({ error: `Unsupported file type: ${file.originalname}` });
    }

    await ensureStorageReady();

    const uniqueFileName = `${Date.now()}-${file.originalname}`;
    const { encryptedBuffer, encryptionIv, encryptionTag } = encryptFileBuffer(file.buffer);

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: uniqueFileName,
      Body: encryptedBuffer,
      ContentType: "application/octet-stream"
    });

    await s3Client.send(command);

    res.status(200).json({
      message: "File uploaded successfully",
      filePath: uniqueFileName,
      encryption_iv: encryptionIv,
      encryption_tag: encryptionTag
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
    const { original_name, s3_key, mime_type, encryption_iv, encryption_tag } = req.body;

    if (!original_name || !s3_key || !encryption_iv || !encryption_tag) {
      return res
        .status(400)
        .json({ error: "original_name, s3_key, encryption_iv, and encryption_tag are required" });
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
          encryption_iv,
          encryption_tag,
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
      encryption_iv: createdVersion.encryption_iv,
      encryption_tag: createdVersion.encryption_tag,
      uploaded_at: createdVersion.uploaded_at
    });
  } catch (error) {
    console.error("Database insert error:", error);
    res.status(500).json({
      error: `Failed to save document info to database${error.message ? `: ${error.message}` : ""}`
    });
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
        encryption_iv: version.encryption_iv,
        encryption_tag: version.encryption_tag,
        placeholder_id: version.placeholder_id,
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
      select: {
        original_name: true,
        mime_type: true,
        encryption_iv: true,
        encryption_tag: true
      }
    });

    if (!documentVersion) {
      return res.status(404).json({ error: "Document not found" });
    }

    if (!documentVersion.encryption_iv || !documentVersion.encryption_tag) {
      return res.status(500).json({ error: "Document encryption metadata is missing" });
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

    const encryptedBuffer = await readObjectBodyAsBuffer(objectResponse.Body);
    const decryptedBuffer = decryptFileBuffer(
      encryptedBuffer,
      documentVersion.encryption_iv,
      documentVersion.encryption_tag
    );

    res.setHeader("Content-Type", documentVersion.mime_type || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${safeFileName}"`);
    res.send(decryptedBuffer);
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
      async (tx) => {
        return Promise.all(
          placeholders.map(async (placeholder) => {
            const attachedFiles = Array.isArray(placeholder.attached_files) ? placeholder.attached_files : [];
            const createdPlaceholder = await tx.casePlaceholder.create({
              data: {
                case_id: Number(caseId),
                name: String(placeholder.name || "").trim(),
                status: attachedFiles.length ? "Uploaded" : String(placeholder.status || "Pending")
              }
            });

            for (const file of attachedFiles) {
              if (!file?.original_name || !file?.s3_key) continue;

              const document = await tx.document.create({
                data: {
                  case_id: Number(caseId),
                  name: file.original_name
                }
              });

              await tx.documentVersion.create({
                data: {
                  document_id: document.id,
                  placeholder_id: createdPlaceholder.id,
                  original_name: file.original_name,
                  s3_key: file.s3_key,
                  mime_type: file.mime_type || null,
                  encryption_iv: file.encryption_iv || null,
                  encryption_tag: file.encryption_tag || null,
                  uploaded_by: req.auth.id
                }
              });
            }

            return tx.casePlaceholder.findUnique({
              where: { id: createdPlaceholder.id },
              include: {
                versions: {
                  orderBy: { uploaded_at: "asc" }
                }
              }
            });
          })
        );
      },
      {
        isolationLevel: "Serializable"
      }
    );

    res.status(201).json(created.map(serializePlaceholder));
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
      include: {
        versions: {
          orderBy: { uploaded_at: "asc" }
        }
      },
      orderBy: [{ created_at: "asc" }, { id: "asc" }]
    });

    res.json(placeholders.map(serializePlaceholder));
  } catch (error) {
    console.error("Fetch placeholders error:", error);
    res.status(500).json({ error: "Failed to fetch placeholders" });
  }
});

app.put("/api/cases/:id/placeholders/:placeholderId/link", requireCaseEditAccess, async (req, res) => {
  try {
    const caseId = req.params.id;
    const placeholderId = req.params.placeholderId;
    const { original_name, s3_key, mime_type, encryption_iv, encryption_tag } = req.body;

    if (!/^\d+$/.test(String(caseId)) || !/^\d+$/.test(String(placeholderId))) {
      return res.status(400).json({ error: "Invalid case or placeholder id" });
    }

    if (!original_name || !s3_key || !encryption_iv || !encryption_tag) {
      return res
        .status(400)
        .json({ error: "original_name, s3_key, encryption_iv, and encryption_tag are required" });
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

    await prisma.documentVersion.update({
      where: { id: documentVersion.id },
      data: {
        placeholder_id: Number(placeholderId),
        original_name,
        mime_type: mime_type || null,
        encryption_iv,
        encryption_tag
      }
    });

    const updatedPlaceholder = await prisma.casePlaceholder.update({
      where: { id: Number(placeholderId) },
      data: {
        status: "Uploaded"
      },
      include: {
        versions: {
          orderBy: { uploaded_at: "asc" }
        }
      }
    });

    res.json(serializePlaceholder(updatedPlaceholder));
  } catch (error) {
    console.error("Link placeholder error:", error);
    res.status(500).json({ error: "Failed to link placeholder" });
  }
});

app.put("/api/cases/:id/placeholders/:placeholderId/upload", requireCaseEditAccess, async (req, res) => {
  try {
    const caseId = req.params.id;
    const placeholderId = req.params.placeholderId;
    const { original_name, s3_key, mime_type, encryption_iv, encryption_tag } = req.body;

    if (!/^\d+$/.test(String(caseId)) || !/^\d+$/.test(String(placeholderId))) {
      return res.status(400).json({ error: "Invalid case or placeholder id" });
    }

    if (!original_name || !s3_key || !encryption_iv || !encryption_tag) {
      return res
        .status(400)
        .json({ error: "original_name, s3_key, encryption_iv, and encryption_tag are required" });
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

    const result = await prisma.$transaction(async (tx) => {
      const document = await tx.document.create({
        data: {
          case_id: Number(caseId),
          name: original_name
        }
      });

      const version = await tx.documentVersion.create({
        data: {
          document_id: document.id,
          placeholder_id: Number(placeholderId),
          original_name,
          s3_key,
          mime_type: mime_type || null,
          encryption_iv,
          encryption_tag,
          uploaded_by: req.auth.id
        }
      });

      const updatedPlaceholder = await tx.casePlaceholder.update({
        where: { id: Number(placeholderId) },
        data: {
          status: "Uploaded"
        },
        include: {
          versions: {
            orderBy: { uploaded_at: "asc" }
          }
        }
      });

      return { version, placeholder: updatedPlaceholder };
    });

    res.status(201).json({
      version: {
        id: result.version.id,
        placeholder_id: result.version.placeholder_id,
        original_name: result.version.original_name,
        s3_key: result.version.s3_key,
        mime_type: result.version.mime_type,
        encryption_iv: result.version.encryption_iv,
        encryption_tag: result.version.encryption_tag,
        uploaded_at: result.version.uploaded_at
      },
      placeholder: serializePlaceholder(result.placeholder)
    });
  } catch (error) {
    console.error("Placeholder upload error:", error);
    res.status(500).json({ error: "Failed to upload placeholder version" });
  }
});

app.get("/api/placeholders/:placeholderId/history", requireStaffAuth, async (req, res) => {
  try {
    const placeholderId = Number(req.params.placeholderId);
    if (!Number.isInteger(placeholderId) || placeholderId <= 0) {
      return res.status(400).json({ error: "Invalid placeholder id" });
    }

    const placeholder = await prisma.casePlaceholder.findUnique({
      where: { id: placeholderId },
      include: {
        case: {
          select: {
            owner_id: true,
            case_assignments: {
              where: { user_id: Number(req.auth.id) },
              select: { id: true }
            }
          }
        },
        versions: {
          orderBy: { uploaded_at: "asc" }
        }
      }
    });

    if (!placeholder) {
      return res.status(404).json({ error: "Placeholder not found" });
    }

    const access = buildCaseAccessFlags(
      {
        owner_id: placeholder.case.owner_id,
        case_assignments: placeholder.case.case_assignments
      },
      req.auth.id,
      req.auth.role
    );

    if (!access.canView) {
      return res.status(403).json({ error: "You do not have access to this placeholder" });
    }

    res.json(
      placeholder.versions.map((version) => ({
        id: version.id,
        placeholder_id: version.placeholder_id,
        original_name: version.original_name,
        s3_key: version.s3_key,
        mime_type: version.mime_type,
        encryption_iv: version.encryption_iv,
        encryption_tag: version.encryption_tag,
        uploaded_at: version.uploaded_at
      }))
    );
  } catch (error) {
    console.error("Fetch placeholder history error:", error);
    res.status(500).json({ error: "Failed to fetch placeholder history" });
  }
});

app.get("/api/settings/case-pattern", requireAuth, async (req, res) => {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { setting_key: CASE_NUMBER_SETTING_KEY }
    });

    res.json({
      pattern: setting?.pattern || "",
      current_sequence: setting?.current_sequence || 0,
      is_configured: Boolean(setting?.pattern)
    });
  } catch (error) {
    console.error("Fetch case pattern error:", error);
    res.status(500).json({ error: "Failed to fetch case pattern settings" });
  }
});

app.delete("/api/cases/:id/placeholders/:placeholderId", requireCaseEditAccess, async (req, res) => {
  try {
    const caseId = req.params.id;
    const placeholderId = req.params.placeholderId;

    if (!/^\d+$/.test(String(caseId)) || !/^\d+$/.test(String(placeholderId))) {
      return res.status(400).json({ error: "Invalid case or placeholder id" });
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

    const documentVersions = await prisma.documentVersion.findMany({
      where: {
        placeholder_id: Number(placeholderId),
        document: {
          case_id: Number(caseId)
        }
      },
      select: {
        id: true,
        document_id: true,
        s3_key: true
      }
    });

    for (const version of documentVersions) {
      await deleteStoredFileByKey(version.s3_key);
    }

    const deletedDocumentIds = [...new Set(documentVersions.map((version) => version.document_id))];

    await prisma.$transaction(async (tx) => {
      await tx.casePlaceholder.delete({
        where: { id: Number(placeholderId) }
      });

      if (documentVersions.length) {
        await tx.documentVersion.deleteMany({
          where: {
            id: { in: documentVersions.map((version) => version.id) }
          }
        });

        if (deletedDocumentIds.length) {
          const remainingVersions = await tx.documentVersion.groupBy({
            by: ["document_id"],
            where: {
              document_id: { in: deletedDocumentIds }
            }
          });

          const remainingDocumentIds = new Set(remainingVersions.map((entry) => entry.document_id));
          const orphanedDocumentIds = deletedDocumentIds.filter(
            (documentId) => !remainingDocumentIds.has(documentId)
          );

          if (orphanedDocumentIds.length) {
            await tx.document.deleteMany({
              where: {
                id: { in: orphanedDocumentIds }
              }
            });
          }
        }
      }
    });

    res.json({
      success: true,
      placeholder_id: Number(placeholderId),
      deleted_s3_keys: documentVersions.map((version) => version.s3_key)
    });
  } catch (error) {
    console.error("Delete placeholder error:", error);
    res.status(500).json({ error: "Failed to delete placeholder and attached files" });
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
    const requestedFilter = String(req.query.filter || "all").trim().toLowerCase();
    console.log("User Role:", req.user.role);
    console.log("Query Filter:", req.query.filter);

    const queryOptions = {
      include: {
        client: { select: { full_name: true } },
        owner: { select: { username: true, full_name: true } },
        case_assignments: {
          where: { user_id: Number(req.auth.id) },
          select: { id: true }
        },
        documents: { select: { id: true } },
        case_placeholders: {
          select: {
            id: true,
            name: true,
            status: true
          },
          orderBy: [{ created_at: "asc" }, { id: "asc" }]
        }
      },
      orderBy: { created_at: "desc" }
    };

    if (req.user.role === "lawyer" && requestedFilter === "my-cases") {
      queryOptions.where = {
        OR: [
          { owner_id: Number(req.user.id) },
          { case_assignments: { some: { user_id: Number(req.user.id) } } }
        ]
      };
      console.log("Applying Lawyer My-Cases Filter:", queryOptions.where);
    } else if (req.user.role === "assistant") {
      queryOptions.where = {
        case_assignments: { some: { user_id: Number(req.user.id) } }
      };
    }

    const cases = await prisma.case.findMany(queryOptions);

    res.json(
      cases.map((entry) => {
        const access = buildCaseAccessFlags(entry, req.auth.id, req.auth.role);

        return {
          id: entry.id,
          name: entry.name,
          case_number: entry.case_number || "",
          client_id: entry.client_id,
          owner_id: entry.owner_id,
          status: entry.status,
          deadline: formatDateOnly(entry.deadline),
          short_description: entry.short_description,
          created_at: entry.created_at,
          client_name: entry.client?.full_name || "",
          owner_username: entry.owner?.username || "",
          owner_full_name: entry.owner?.full_name || "",
          placeholders: entry.case_placeholders.map((placeholder) => ({
            id: placeholder.id,
            name: placeholder.name,
            status: placeholder.status || "Pending"
          })),
          is_owner: access.isOwner,
          is_assigned: access.isAssigned,
          can_edit: access.canEdit
        };
      })
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "Failed to fetch cases" });
  }
});

app.post("/api/dashboard/upload", requireStaffAuth, upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    const caseId = Number(req.body.case_id);
    const placeholderInput = String(req.body.placeholder_id || "").trim();
    const newPlaceholderName = String(req.body.new_placeholder_name || "").trim();

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    if (!Number.isInteger(caseId) || caseId <= 0) {
      return res.status(400).json({ error: "Valid case_id is required" });
    }

    if (!placeholderInput) {
      return res.status(400).json({ error: "placeholder_id is required" });
    }

    if (!isSupportedUploadName(file.originalname)) {
      return res.status(400).json({ error: `Unsupported file type: ${file.originalname}` });
    }

    const caseEntry = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        case_assignments: {
          select: { user_id: true }
        }
      }
    });

    if (!caseEntry) {
      return res.status(404).json({ error: "Case not found" });
    }

    const isOwner = String(caseEntry.owner_id || "") === String(req.auth.id);
    const isAssigned = caseEntry.case_assignments.some(
      (assignment) => String(assignment.user_id) === String(req.auth.id)
    );

    if (req.auth.role !== "admin" && !isOwner && !isAssigned) {
      return res.status(403).json({ error: "You do not have upload access to this case" });
    }

    let placeholderId = null;
    if (placeholderInput === "NEW") {
      if (!newPlaceholderName) {
        return res.status(400).json({ error: "new_placeholder_name is required when creating a new placeholder" });
      }
    } else {
      placeholderId = Number(placeholderInput);
      if (!Number.isInteger(placeholderId) || placeholderId <= 0) {
        return res.status(400).json({ error: "placeholder_id must be a valid placeholder id or NEW" });
      }
    }

    await ensureStorageReady();
    const uniqueFileName = `${Date.now()}-${file.originalname}`;
    const { encryptedBuffer, encryptionIv, encryptionTag } = encryptFileBuffer(file.buffer);

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: uniqueFileName,
        Body: encryptedBuffer,
        ContentType: "application/octet-stream"
      })
    );

    const result = await prisma.$transaction(async (tx) => {
      let resolvedPlaceholderId = placeholderId;

      if (placeholderInput === "NEW") {
        const newPlaceholder = await tx.casePlaceholder.create({
          data: {
            case_id: caseId,
            name: newPlaceholderName,
            status: "Uploaded"
          }
        });
        resolvedPlaceholderId = newPlaceholder.id;
      } else {
        const existingPlaceholder = await tx.casePlaceholder.findFirst({
          where: {
            id: placeholderId,
            case_id: caseId
          }
        });

        if (!existingPlaceholder) {
          throw new Error("Placeholder not found for this case");
        }

        await tx.casePlaceholder.update({
          where: { id: placeholderId },
          data: { status: "Uploaded" }
        });
      }

      const document = await tx.document.create({
        data: {
          case_id: caseId,
          name: file.originalname
        }
      });

      const version = await tx.documentVersion.create({
        data: {
          document_id: document.id,
          placeholder_id: resolvedPlaceholderId,
          original_name: file.originalname,
          s3_key: uniqueFileName,
          mime_type: file.mimetype || "application/octet-stream",
          encryption_iv: encryptionIv,
          encryption_tag: encryptionTag,
          uploaded_by: req.auth.id
        }
      });

      const placeholder = await tx.casePlaceholder.findUnique({
        where: { id: resolvedPlaceholderId },
        select: { id: true, name: true, status: true }
      });

      return { version, placeholder };
    });

    res.status(201).json({
      document: {
        id: result.version.id,
        case_id: caseId,
        original_name: result.version.original_name,
        s3_key: result.version.s3_key,
        mime_type: result.version.mime_type,
        encryption_iv: result.version.encryption_iv,
        encryption_tag: result.version.encryption_tag,
        uploaded_at: result.version.uploaded_at,
        placeholder_id: result.placeholder?.id || null,
        placeholder_name: result.placeholder?.name || null
      },
      placeholder: result.placeholder
    });
  } catch (error) {
    console.error("Dashboard upload error:", error);
    const statusCode = String(error.message || "").includes("Placeholder not found") ? 404 : 500;
    res.status(statusCode).json({ error: error.message || "Failed to upload document from dashboard" });
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

    const access = buildCaseAccessFlags(entry, req.auth.id, req.auth.role);

    if (!access.canView) {
      return res.status(403).json({ error: "You do not have access to this case" });
    }

    res.json({
      id: entry.id,
      name: entry.name,
      case_number: entry.case_number || "",
      client_id: entry.client_id,
      owner_id: entry.owner_id,
      status: entry.status,
      deadline: formatDateOnly(entry.deadline),
      short_description: entry.short_description,
      created_at: entry.created_at,
      client_name: entry.client?.full_name || "",
      owner_username: entry.owner?.username || "",
      owner_full_name: entry.owner?.full_name || "",
      is_owner: access.isOwner,
      is_assigned: access.isAssigned,
      can_edit: access.canEdit
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch case" });
  }
});

app.put("/api/cases/:id", requireCaseEditAccess, async (req, res) => {
  try {
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "case_number")) {
      return res.status(400).json({ error: "case_number is immutable and cannot be changed" });
    }

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

// =========================================================
// ERV (Elektronischer Rechtsverkehr) SECURE TRANSMISSION ENDPOINT
// =========================================================
// POST /api/cases/:id/erv-transmit
// Strict RBAC: Only Case Owner or Admin can transmit documents to court
// This is a secure proxy that:
// 1. Verifies the user is authorized (owner or admin)
// 2. Internally converts documents to SOAP format
// 3. Calls the /services/ERVNachrichtPort mock endpoint
// 4. Updates the case status to "Filed via ERV"
// 5. Returns JSON response with NachrichtenID (not XML)

app.post("/api/cases/:id/erv-transmit", requireAuth, async (req, res) => {
  try {
    const caseId = Number(req.params.id);

    // Validate case ID
    if (!Number.isInteger(caseId) || caseId <= 0) {
      return res.status(400).json({ error: "Invalid case id" });
    }

    // Fetch the case with owner information
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        owner_id: true,
        case_number: true,
        name: true,
        status: true
      }
    });

    if (!caseData) {
      return res.status(404).json({ error: "Case not found" });
    }

    // =========================================================
    // STRICT RBAC: Only Case Owner or Admin can transmit
    // =========================================================
    const isAdmin = req.user.role === "admin";
    const isCaseOwner = String(req.user.id) === String(caseData.owner_id);

    if (!isAdmin && !isCaseOwner) {
      console.warn(
        `[ERV-RBAC] Unauthorized ERV transmission attempt by user ${req.user.id} ` +
        `(role: ${req.user.role}) on case ${caseId} (owner: ${caseData.owner_id})`
      );
      return res.status(403).json({
        error: "Forbidden: Only the Case Owner or an Admin can transmit documents to ERV."
      });
    }

    console.log(`[ERV-TRANSMIT] Authorized transmission by ${isAdmin ? "Admin" : "Case Owner"} (user: ${req.user.id}) for case ${caseId}`);

    // =========================================================
    // FETCH DOCUMENTS AND GENERATE SOAP REQUEST
    // =========================================================
    // Get latest documents from each placeholder
    const documentVersions = await prisma.documentVersion.findMany({
      where: {
        document: {
          case_id: caseId
        },
        placeholder_id: { not: null }
      },
      include: {
        document: {
          select: { id: true, name: true }
        },
        placeholder: {
          select: { id: true, name: true }
        }
      },
      orderBy: { uploaded_at: "desc" }
    });

    // Group by placeholder and keep only latest version
    const latestByPlaceholder = new Map();
    for (const doc of documentVersions) {
      if (!latestByPlaceholder.has(doc.placeholder_id)) {
        latestByPlaceholder.set(doc.placeholder_id, doc);
      }
    }

    const documentsToTransmit = Array.from(latestByPlaceholder.values());

    if (documentsToTransmit.length === 0) {
      return res.status(400).json({
        error: "No documents to transmit. Please ensure all required placeholders have documents uploaded."
      });
    }

    // Build SOAP request (simplified internal version)
    const messageId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    const soapRequest = `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://www.signaling.at/erv">
  <SOAP-ENV:Body>
    <tns:SendNachricht>
      <tns:Nachricht>
        <tns:NachrichtentyP>Klageeinreichung</tns:NachrichtentyP>
        <tns:Gerichtscode>Z123456789</tns:Gerichtscode>
        <tns:AbsenderCode>TESTLAW001</tns:AbsenderCode>
        <tns:Zeitstempel>${timestamp}</tns:Zeitstempel>
        <tns:NachrichtenID>${messageId}</tns:NachrichtenID>
        <tns:Betreff>${caseData.name || "Klageeinreichung"}</tns:Betreff>
        <tns:Inhalt>
          <tns:Hauptdokument>${documentsToTransmit[0]?.document?.name || "Hauptdokument"}</tns:Hauptdokument>
          <tns:AnlagenCount>${documentsToTransmit.length}</tns:AnlagenCount>
        </tns:Inhalt>
      </tns:Nachricht>
    </tns:SendNachricht>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;

    console.log(`[ERV-TRANSMIT] Generated SOAP request with MessageID: ${messageId}`);

    // =========================================================
    // INTERNAL CALL TO SOAP ENDPOINT
    // =========================================================
    // Call the internal mock ERV service via HTTP
    const soapResponse = await fetch(`http://localhost:${PORT}/services/ERVNachrichtPort`, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "Accept": "text/xml"
      },
      body: soapRequest
    });

    if (!soapResponse.ok) {
      const errorText = await soapResponse.text();
      console.error(
        `[ERV-TRANSMIT] SOAP endpoint returned status ${soapResponse.status}: ${errorText.substring(0, 200)}`
      );
      return res.status(502).json({
        error: `ERV service returned error ${soapResponse.status}. Please try again later.`
      });
    }

    const soapResponseText = await soapResponse.text();
    console.log(`[ERV-TRANSMIT] SOAP response received (${soapResponseText.length} bytes)`);

    // Extract NachrichtenID from SOAP response
    const nachrichtenIdMatch = soapResponseText.match(/<tns:NachrichtenID>([^<]+)<\/tns:NachrichtenID>/);
    const responseNachrichtenId = nachrichtenIdMatch ? nachrichtenIdMatch[1] : messageId;

    // =========================================================
    // UPDATE CASE STATUS IN DATABASE
    // =========================================================
    const updatedCase = await prisma.case.update({
      where: { id: caseId },
      data: {
        status: "Filed via ERV"
      }
    });

    console.log(
      `[ERV-TRANSMIT] Case ${caseId} status updated to "Filed via ERV" with NachrichtenID: ${responseNachrichtenId}`
    );

    // =========================================================
    // RETURN JSON RESPONSE (NOT XML)
    // =========================================================
    res.json({
      success: true,
      message: "Documents successfully transmitted to ERV.",
      caseId: caseId,
      nachrichtenId: responseNachrichtenId,
      timestamp: timestamp,
      documentsCount: documentsToTransmit.length,
      newStatus: updatedCase.status
    });

  } catch (error) {
    console.error("[ERV-TRANSMIT] Error:", error);
    res.status(500).json({
      error: error.message || "Failed to transmit documents to ERV"
    });
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

    const casePatternSetting = await prisma.systemSetting.findUnique({
      where: { setting_key: CASE_NUMBER_SETTING_KEY }
    });

    if (!casePatternSetting?.pattern) {
      return res
        .status(403)
        .json({ error: "Admin must configure the case number pattern first." });
    }

    const [ownerUser, client] = await Promise.all([
      prisma.user.findUnique({
        where: { id: Number(req.auth.id) },
        select: {
          username: true,
          full_name: true
        }
      }),
      prisma.client.findUnique({
        where: { id: Number(client_id) },
        select: {
          full_name: true
        }
      })
    ]);

    if (!ownerUser) {
      return res.status(404).json({ error: "Owner user not found" });
    }

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    const lawyerInitials = getInitials(ownerUser.full_name || ownerUser.username || "");
    const clientInitials = getInitials(client.full_name || "");

    const createdCase = await prisma.$transaction(
      async (tx) => {
        const incrementedSetting = await tx.systemSetting.update({
          where: { setting_key: CASE_NUMBER_SETTING_KEY },
          data: {
            current_sequence: {
              increment: 1
            }
          }
        });

        const generatedCaseNumber = generateCaseNumber(
          incrementedSetting.pattern,
          incrementedSetting.current_sequence,
          {
            lawyerInitials,
            clientInitials
          }
        );

        return tx.case.create({
          data: {
            name,
            case_number: generatedCaseNumber,
            client_id: Number(client_id),
            owner_id: req.auth.id,
            status: status || "open",
            deadline: deadline ? new Date(deadline) : null,
            short_description: short_description || null
          }
        });
      },
      {
        isolationLevel: "Serializable"
      }
    );

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
    const entry = await prisma.case.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        case_assignments: {
          where: { user_id: Number(req.auth.id) },
          select: { id: true }
        }
      }
    });

    if (!entry) {
      return res.status(404).json({ error: "Case not found" });
    }

    const access = buildCaseAccessFlags(entry, req.auth.id, req.auth.role);
    if (!access.canView) {
      return res.status(403).json({ error: "You do not have access to this case" });
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

app.put("/api/admin/settings/case-pattern", requireRole(["admin"]), async (req, res) => {
  try {
    const pattern = normalizeCasePattern(req.body.pattern);

    if (!pattern) {
      return res.status(400).json({ error: "pattern is required" });
    }

    if (!/\[SEQ(?:3|4)?\]/.test(pattern)) {
      return res.status(400).json({ error: "pattern must include [SEQ], [SEQ3], or [SEQ4]" });
    }

    const existingSetting = await prisma.systemSetting.findUnique({
      where: { setting_key: CASE_NUMBER_SETTING_KEY }
    });

    const shouldResetSequence = !existingSetting || existingSetting.pattern !== pattern;

    const updatedSetting = await prisma.systemSetting.upsert({
      where: { setting_key: CASE_NUMBER_SETTING_KEY },
      update: {
        pattern,
        current_sequence: shouldResetSequence ? 0 : existingSetting.current_sequence
      },
      create: {
        setting_key: CASE_NUMBER_SETTING_KEY,
        pattern,
        current_sequence: 0
      }
    });

    res.json({
      setting: {
        pattern: updatedSetting.pattern || "",
        current_sequence: updatedSetting.current_sequence,
        is_configured: Boolean(updatedSetting.pattern)
      }
    });
  } catch (error) {
    console.error("Update case pattern error:", error);
    res.status(500).json({ error: "Failed to update case pattern settings" });
  }
});

async function updateUserRole(req, res) {
  try {
    const targetUserId = Number(req.params.id);
    const authUserId = Number(req.auth.id);
    const nextRole = normalizeUserRole(String(req.body.role || "").trim().toLowerCase());
    
    if (!["admin", "lawyer", "assistant", "client"].includes(nextRole)) {
      return res.status(400).json({ error: "role must be admin, lawyer, assistant, or client" });
    }

    // Prevent admins from changing their own role (security guardrail)
    if (targetUserId === authUserId && req.auth.role === "admin") {
      // Fetch the current role to check if it would change
      const currentUser = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: { role: true }
      });
      
      if (currentUser && currentUser.role !== nextRole) {
        console.log(`[SECURITY] Admin ${authUserId} attempted to change their own role from ${currentUser.role} to ${nextRole}`);
        return res.status(403).json({ error: "You cannot change your own administrative role. Please contact another administrator if a change is required." });
      }
    }

    const user = await prisma.user.update({
      where: { id: targetUserId },
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
      user_id: authUser.id,
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

// ---------------------------------------------------------
// COMMENTS ROUTES - Case Collaboration Chat
// ---------------------------------------------------------

app.get("/api/cases/:id/comments", requireStaffAuth, async (req, res) => {
  try {
    const caseId = Number(req.params.id);
    if (!Number.isInteger(caseId) || caseId <= 0) {
      return res.status(400).json({ error: "Invalid case id" });
    }

    // Check case access by fetching case with current user's assignment status
    const caseEntry = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        case_assignments: {
          where: { user_id: Number(req.auth.id) },
          select: { id: true }
        }
      }
    });

    if (!caseEntry) {
      return res.status(404).json({ error: "Case not found" });
    }

    const access = buildCaseAccessFlags(caseEntry, req.auth.id, req.auth.role);
    if (!access.canView) {
      return res.status(403).json({ error: "You do not have access to this case" });
    }

    // Fetch all comments for the case, sorted by creation date ascending (oldest first)
    const comments = await prisma.comment.findMany({
      where: { case_id: caseId },
      include: {
        user: {
          select: {
            id: true,
            full_name: true,
            username: true,
            role: true
          }
        }
      },
      orderBy: { created_at: "asc" }
    });

    // Serialize comments with user information
    const serializedComments = comments.map((comment) => ({
      id: comment.id,
      case_id: comment.case_id,
      user_id: comment.user_id,
      content: comment.content,
      created_at: comment.created_at,
      user: {
        id: comment.user.id,
        full_name: comment.user.full_name,
        username: comment.user.username,
        role: comment.user.role
      }
    }));

    res.json(serializedComments);
  } catch (error) {
    console.error("Fetch comments error:", error);
    res.status(500).json({ error: "Failed to fetch comments" });
  }
});

app.post("/api/cases/:id/comments", requireStaffAuth, async (req, res) => {
  try {
    const caseId = Number(req.params.id);
    const { content } = req.body;

    if (!Number.isInteger(caseId) || caseId <= 0) {
      return res.status(400).json({ error: "Invalid case id" });
    }

    if (!content || typeof content !== "string" || !content.trim()) {
      return res.status(400).json({ error: "Comment content is required" });
    }

    // Check case access by fetching case with current user's assignment status
    const caseEntry = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        case_assignments: {
          where: { user_id: Number(req.auth.id) },
          select: { id: true }
        }
      }
    });

    if (!caseEntry) {
      return res.status(404).json({ error: "Case not found" });
    }

    const access = buildCaseAccessFlags(caseEntry, req.auth.id, req.auth.role);
    
    // Debug logging
    console.log(`[COMMENT AUTH DEBUG] User: ${req.auth.id}, Role: ${req.auth.role}, Case Owner: ${caseEntry.owner_id}, Assignments: ${JSON.stringify(caseEntry.case_assignments)}, canEdit: ${access.canEdit}, isAssigned: ${access.isAssigned}`);
    
    if (!access.canEdit) {
      console.log(`[COMMENT AUTH DENIED] User ${req.auth.id} (${req.auth.role}) denied access to comment on case ${caseId}`);
      return res.status(403).json({ error: "You do not have permission to comment on this case" });
    }

    // Create the comment
    const comment = await prisma.comment.create({
      data: {
        case_id: caseId,
        user_id: req.auth.id,
        content: content.trim()
      },
      include: {
        user: {
          select: {
            id: true,
            full_name: true,
            username: true,
            role: true
          }
        }
      }
    });

    // Serialize response
    res.status(201).json({
      id: comment.id,
      case_id: comment.case_id,
      user_id: comment.user_id,
      content: comment.content,
      created_at: comment.created_at,
      user: {
        id: comment.user.id,
        full_name: comment.user.full_name,
        username: comment.user.username,
        role: comment.user.role
      }
    });
  } catch (error) {
    console.error("Create comment error:", error);
    res.status(500).json({ error: "Failed to create comment" });
  }
});

// ---------------------------------------------------------
// ERROR HANDLERS AND DIAGNOSTICS
// ---------------------------------------------------------
// Catch all 404 requests
app.use((req, res) => {
  console.error(`[404] ${req.method} ${req.path} - Not found`);
  console.error(`[404] Content-Type: ${req.get('Content-Type')}`);
  if (req.body) {
    console.error(`[404] Body (first 200 chars): ${String(req.body).substring(0, 200)}`);
  }
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

ensureRemoteAccessSchema()
  .then(() => ensureBootstrapAdmin())
  .then(() => (SEED_DEMO_DATA ? seedDemoData() : null))
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Backend running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to prepare backend schema", error);
    process.exit(1);
  });
