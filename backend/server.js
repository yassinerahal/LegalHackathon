const cors = require("cors");
const express = require("express");
const pool = require("./db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

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
    console.error(error);
    console.error("Create case error:", error);
    res.status(500).json({ error: error.message });  }
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
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});