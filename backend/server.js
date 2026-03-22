const cors = require("cors");
const express = require("express");
const pool = require("./db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { bucketName, ensureStorageReady, initStorage, s3Client } = require("./s3");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

async function caseExists(caseId) {
  const result = await pool.query("SELECT id FROM cases WHERE id = $1", [caseId]);
  return result.rows.length > 0;
}

async function placeholderBelongsToCase(caseId, placeholderId) {
  const result = await pool.query(
    "SELECT id FROM case_placeholders WHERE id = $1 AND case_id = $2",
    [placeholderId, caseId]
  );
  return result.rows.length > 0;
}

// ---------------------------------------------------------
// MULTER CONFIGURATION FOR S3 UPLOADS
// ---------------------------------------------------------
const upload = multer({ storage: multer.memoryStorage() });

// Health check
app.get("/api/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({ ok: true, time: result.rows[0].now });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Database connection failed" });
  }
});

// ---------------------------------------------------------
// FILE UPLOAD ROUTE (LOCALSTACK S3)
// ---------------------------------------------------------
app.post("/api/upload", upload.single("document"), async (req, res) => {
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
app.post("/api/cases/:id/documents", async (req, res) => {
  try {
    const caseId = req.params.id;
    const { original_name, s3_key, mime_type } = req.body;

    if (!original_name || !s3_key) {
      return res.status(400).json({ error: "original_name and s3_key are required" });
    }

    if (!(await caseExists(caseId))) {
      return res.status(404).json({ error: "Case not found" });
    }

    const result = await pool.query(
      `INSERT INTO case_documents (case_id, original_name, s3_key, mime_type)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [caseId, original_name, s3_key, mime_type]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Database insert error:", error);
    res.status(500).json({ error: "Failed to save document info to database" });
  }
});

app.get("/api/cases/:id/documents", async (req, res) => {
  try {
    const caseId = req.params.id;

    if (!/^\d+$/.test(String(caseId))) {
      return res.status(400).json({ error: "Invalid case id" });
    }

    if (!(await caseExists(caseId))) {
      return res.status(404).json({ error: "Case not found" });
    }

    // Return only the documents that are explicitly linked to this case.
    const result = await pool.query(
      `
      SELECT id, case_id, original_name, s3_key, mime_type, uploaded_at
      FROM case_documents
      WHERE case_id = $1
      ORDER BY uploaded_at DESC, id DESC
      `,
      [caseId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Fetch case documents error:", error);
    res.status(500).json({ error: "Failed to fetch case documents" });
  }
});

app.post("/api/cases/:id/placeholders", async (req, res) => {
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

    const values = [];
    const params = [];

    placeholders.forEach((placeholder, index) => {
      const offset = index * 4;
      params.push(
        caseId,
        String(placeholder.name || "").trim(),
        String(placeholder.status || "Pending"),
        placeholder.linked_s3_key || null
      );
      values.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`);
    });

    if (params.some((value, index) => index % 4 === 1 && !value)) {
      return res.status(400).json({ error: "Each placeholder requires a name" });
    }

    const result = await pool.query(
      `
      INSERT INTO case_placeholders (case_id, name, status, linked_s3_key)
      VALUES ${values.join(", ")}
      RETURNING *
      `,
      params
    );

    res.status(201).json(result.rows);
  } catch (error) {
    console.error("Create placeholders error:", error);
    res.status(500).json({ error: "Failed to create placeholders" });
  }
});

app.get("/api/cases/:id/placeholders", async (req, res) => {
  try {
    const caseId = req.params.id;

    if (!/^\d+$/.test(String(caseId))) {
      return res.status(400).json({ error: "Invalid case id" });
    }

    if (!(await caseExists(caseId))) {
      return res.status(404).json({ error: "Case not found" });
    }

    const result = await pool.query(
      `
      SELECT id, case_id, name, status, linked_s3_key, created_at
      FROM case_placeholders
      WHERE case_id = $1
      ORDER BY created_at ASC, id ASC
      `,
      [caseId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Fetch placeholders error:", error);
    res.status(500).json({ error: "Failed to fetch placeholders" });
  }
});

app.put("/api/cases/:id/placeholders/:placeholderId/link", async (req, res) => {
  try {
    const caseId = req.params.id;
    const placeholderId = req.params.placeholderId;
    const { s3_key } = req.body;

    if (!/^\d+$/.test(String(caseId)) || !/^\d+$/.test(String(placeholderId))) {
      return res.status(400).json({ error: "Invalid case or placeholder id" });
    }

    if (!s3_key) {
      return res.status(400).json({ error: "s3_key is required" });
    }

    if (!(await caseExists(caseId))) {
      return res.status(404).json({ error: "Case not found" });
    }

    if (!(await placeholderBelongsToCase(caseId, placeholderId))) {
      return res.status(404).json({ error: "Placeholder not found for this case" });
    }

    const documentResult = await pool.query(
      "SELECT id FROM case_documents WHERE case_id = $1 AND s3_key = $2",
      [caseId, s3_key]
    );

    if (!documentResult.rows.length) {
      return res.status(404).json({ error: "Document not found for this case" });
    }

    const result = await pool.query(
      `
      UPDATE case_placeholders
      SET status = 'Uploaded',
          linked_s3_key = $1
      WHERE id = $2 AND case_id = $3
      RETURNING *
      `,
      [s3_key, placeholderId, caseId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Link placeholder error:", error);
    res.status(500).json({ error: "Failed to link placeholder" });
  }
});

// Get all clients
app.get("/api/clients", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM clients ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch clients" });
  }
});

// Create client
app.post("/api/clients", async (req, res) => {
  try {
    const { full_name, email, phone, address, zip_code, city, state } = req.body;

    const result = await pool.query(
      `INSERT INTO clients (full_name, email, phone, address, zip_code, city, state)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [full_name, email, phone, address, zip_code, city, state]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create client" });
  }
});

// Get all cases with client info
app.get("/api/cases", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        cases.*,
        clients.full_name AS client_name
      FROM cases
      JOIN clients ON cases.client_id = clients.id
      ORDER BY cases.created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("Fetch cases error:", error);
    res.status(500).json({ error: error.message });  
  }
});

// Get one case
app.get("/api/cases/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        cases.*,
        clients.full_name AS client_name
      FROM cases
      JOIN clients ON cases.client_id = clients.id
      WHERE cases.id = $1
      `,
      [req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Case not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch case" });
  }
});

// Signup
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { full_name, email, password } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({ error: "Full name, email, and password are required." });
    }

    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email.trim().toLowerCase()]
    );

    if (existingUser.rows.length) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (full_name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, full_name, email`,
      [full_name.trim(), email.trim().toLowerCase(), password_hash]
    );

    const user = result.rows[0];

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || "dev-secret",
      { expiresIn: "1d" }
    );

    res.status(201).json({ user, token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Signup failed." });
  }
});

// Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const result = await pool.query(
      "SELECT id, full_name, email, password_hash FROM users WHERE email = $1",
      [email.trim().toLowerCase()]
    );

    if (!result.rows.length) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const user = result.rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || "dev-secret",
      { expiresIn: "1d" }
    );

    res.json({
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email
      },
      token
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Login failed." });
  }
});

// Create case
app.post("/api/cases", async (req, res) => {
  try {
    const {
      name,
      client_id,
      status,
      deadline,
      short_description
    } = req.body;

    const result = await pool.query(
      `INSERT INTO cases (name, client_id, status, deadline, short_description)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        name,
        client_id,
        status || "open",
        deadline || null,
        short_description || null
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Create case error:", error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;

// Start server and initialize LocalStack S3 bucket
app.listen(PORT, async () => {
  console.log(`Backend running on port ${PORT}`);
  await initStorage();
});
