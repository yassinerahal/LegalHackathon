const cors = require("cors");
const crypto = require("crypto");
const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const QRCode = require("qrcode");
const pool = require("./db");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const REMOTE_ACCESS_EXPIRY_HOURS = Number(process.env.REMOTE_ACCESS_EXPIRY_HOURS || 48);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..")));

app.get("/remote-setup.html", (req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>NEXTACT - Remote Access Setup</title>
    <style>
      body { margin: 0; font-family: Arial, sans-serif; background: linear-gradient(180deg, #f7faff 0%, #edf4ff 100%); color: #1f2a44; }
      main { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
      .card { width: min(460px, 100%); background: #fff; border: 1px solid #dbe4f3; border-radius: 24px; box-shadow: 0 24px 50px rgba(33, 53, 107, 0.14); padding: 28px; }
      h1 { margin: 0 0 10px; font-size: 1.8rem; }
      p { color: #5d6d8f; line-height: 1.5; }
      label { display: block; font-weight: 600; margin: 14px 0 8px; }
      input { width: 100%; box-sizing: border-box; border: 1px solid #d5deef; border-radius: 14px; padding: 14px 16px; font: inherit; }
      button { margin-top: 18px; width: 100%; border: 0; border-radius: 14px; padding: 14px 16px; background: #3454d1; color: #fff; font: inherit; font-weight: 700; cursor: pointer; }
      button:disabled { opacity: 0.55; cursor: not-allowed; }
      .message { min-height: 1.3em; margin-top: 14px; color: #b0303f; }
      .message.success { color: #0d7a4a; }
      .muted { margin: 0; }
    </style>
  </head>
  <body>
    <main>
      <section class="card">
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

async function ensureRemoteAccessSchema() {
  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS role VARCHAR(50) NOT NULL DEFAULT 'staff',
    ADD COLUMN IF NOT EXISTS client_id INTEGER UNIQUE
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_client_id_fkey'
      ) THEN
        ALTER TABLE users
        ADD CONSTRAINT users_client_id_fkey
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
      END IF;
    END $$;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS remote_access_tokens (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      token_hash VARCHAR(128) UNIQUE NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
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
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}

function requireStaffAuth(req, res, next) {
  return requireAuth(req, res, () => {
    // Backward compatibility: older staff sessions may not include a role claim.
    const isLegacyStaffSession = !req.auth.role && req.auth.email && !req.auth.client_id;
    if (req.auth.role !== "staff" && !isLegacyStaffSession) {
      return res.status(403).json({ error: "Staff access only" });
    }
    return next();
  });
}

function requireRemoteUserAuth(req, res, next) {
  return requireAuth(req, res, () => {
    // Backend enforcement: remote users are always scoped to their linked client record.
    if (req.auth.role !== "remote_user" || !req.auth.client_id) {
      return res.status(403).json({ error: "Remote user access only" });
    }
    return next();
  });
}

async function getActiveRemoteAccessInvite(token) {
  const tokenHash = hashSetupToken(token);
  const result = await pool.query(
    `
      SELECT
        remote_access_tokens.id,
        remote_access_tokens.client_id,
        remote_access_tokens.status,
        remote_access_tokens.expires_at,
        clients.full_name,
        clients.email,
        clients.address,
        clients.phone,
        clients.zip_code,
        clients.city,
        clients.state
      FROM remote_access_tokens
      JOIN clients ON clients.id = remote_access_tokens.client_id
      WHERE remote_access_tokens.token_hash = $1
        AND remote_access_tokens.status = 'active'
        AND remote_access_tokens.expires_at > NOW()
    `,
    [tokenHash]
  );

  return result.rows[0] || null;
}

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

app.get("/api/clients", requireStaffAuth, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM clients ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch clients" });
  }
});

app.get("/api/clients/:id", requireStaffAuth, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM clients WHERE id = $1", [req.params.id]);

    if (!result.rows.length) {
      return res.status(404).json({ error: "Client not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch client" });
  }
});

app.put("/api/clients/:id", requireStaffAuth, async (req, res) => {
  try {
    const { full_name, email, phone, address, zip_code, city, state } = req.body;

    const result = await pool.query(
      `UPDATE clients
       SET full_name = $1,
           email = $2,
           phone = $3,
           address = $4,
           zip_code = $5,
           city = $6,
           state = $7
       WHERE id = $8
       RETURNING *`,
      [full_name, email, phone, address, zip_code, city, state, req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Client not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update client" });
  }
});

app.delete("/api/clients/:id", requireStaffAuth, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM cases WHERE client_id = $1", [req.params.id]);
    const result = await client.query("DELETE FROM clients WHERE id = $1 RETURNING id", [req.params.id]);

    if (!result.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Client not found" });
    }

    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: error.message || "Failed to delete client" });
  } finally {
    client.release();
  }
});

app.post("/api/clients/:id/remote-access", requireStaffAuth, async (req, res) => {
  try {
    const clientResult = await pool.query(
      "SELECT id, full_name, email FROM clients WHERE id = $1",
      [req.params.id]
    );

    if (!clientResult.rows.length) {
      return res.status(404).json({ error: "Client not found" });
    }

    const client = clientResult.rows[0];
    if (!client.email) {
      return res.status(400).json({
        error: "Remote access can only be granted to clients with an email address."
      });
    }

    const conflictingAccount = await pool.query(
      `
        SELECT id
        FROM users
        WHERE LOWER(email) = $1
          AND (role <> 'remote_user' OR client_id IS DISTINCT FROM $2)
      `,
      [client.email.trim().toLowerCase(), client.id]
    );

    if (conflictingAccount.rows.length) {
      return res.status(409).json({
        error: "That email address is already used by another account."
      });
    }

    await pool.query(
      `
        UPDATE remote_access_tokens
        SET status = 'expired'
        WHERE client_id = $1
          AND status = 'active'
      `,
      [client.id]
    );

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashSetupToken(rawToken);

    const tokenResult = await pool.query(
      `
        INSERT INTO remote_access_tokens (client_id, token_hash, status, expires_at)
        VALUES ($1, $2, 'active', NOW() + ($3 || ' hours')::interval)
        RETURNING expires_at
      `,
      [client.id, tokenHash, String(REMOTE_ACCESS_EXPIRY_HOURS)]
    );

    const setupLink = buildSetupLink(req, rawToken);
    const qrCodeDataUrl = await QRCode.toDataURL(setupLink, {
      width: 240,
      margin: 1
    });

    res.json({
      setup_link: setupLink,
      qr_code_data_url: qrCodeDataUrl,
      expires_at: tokenResult.rows[0].expires_at,
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
    const result = await pool.query(
      `SELECT *
       FROM cases
       WHERE client_id = $1
       ORDER BY created_at DESC`,
      [req.params.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch client cases" });
  }
});

app.post("/api/clients", requireStaffAuth, async (req, res) => {
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

app.get("/api/cases", requireStaffAuth, async (req, res) => {
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
    res.status(500).json({ error: error.message || "Failed to fetch cases" });
  }
});

app.get("/api/cases/:id", requireStaffAuth, async (req, res) => {
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

app.put("/api/cases/:id", requireStaffAuth, async (req, res) => {
  try {
    const { name, client_id, status, deadline, short_description } = req.body;

    const result = await pool.query(
      `UPDATE cases
       SET name = $1,
           client_id = $2,
           status = $3,
           deadline = $4,
           short_description = $5
       WHERE id = $6
       RETURNING *`,
      [name, client_id, status || "open", deadline || null, short_description || null, req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Case not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Update case error:", error);
    res.status(500).json({ error: error.message || "Failed to update case" });
  }
});

app.delete("/api/cases/:id", requireStaffAuth, async (req, res) => {
  try {
    const result = await pool.query("DELETE FROM cases WHERE id = $1 RETURNING id", [req.params.id]);

    if (!result.rows.length) {
      return res.status(404).json({ error: "Case not found" });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error("Delete case error:", error);
    res.status(500).json({ error: error.message || "Failed to delete case" });
  }
});

app.post("/api/cases", requireStaffAuth, async (req, res) => {
  try {
    const { name, client_id, status, deadline, short_description } = req.body;

    const result = await pool.query(
      `INSERT INTO cases (name, client_id, status, deadline, short_description)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, client_id, status || "open", deadline || null, short_description || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Create case error:", error);
    res.status(500).json({ error: error.message });
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
  const client = await pool.connect();

  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: "Token and password are required." });
    }

    if (String(password).length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    }

    await client.query("BEGIN");

    const invitationResult = await client.query(
      `
        SELECT
          remote_access_tokens.id,
          remote_access_tokens.client_id,
          clients.full_name,
          clients.email
        FROM remote_access_tokens
        JOIN clients ON clients.id = remote_access_tokens.client_id
        WHERE remote_access_tokens.token_hash = $1
          AND remote_access_tokens.status = 'active'
          AND remote_access_tokens.expires_at > NOW()
        FOR UPDATE
      `,
      [hashSetupToken(token)]
    );

    if (!invitationResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "This remote access link is invalid, expired, or already used."
      });
    }

    const invitation = invitationResult.rows[0];
    const email = invitation.email?.trim().toLowerCase();

    if (!email) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "The linked client record is missing an email address." });
    }

    const conflictingUser = await client.query(
      `
        SELECT id
        FROM users
        WHERE LOWER(email) = $1
          AND (role <> 'remote_user' OR client_id IS DISTINCT FROM $2)
      `,
      [email, invitation.client_id]
    );

    if (conflictingUser.rows.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: "That email address is already associated with another account."
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const existingRemoteUser = await client.query(
      "SELECT id FROM users WHERE role = 'remote_user' AND client_id = $1",
      [invitation.client_id]
    );

    if (existingRemoteUser.rows.length) {
      await client.query(
        `
          UPDATE users
          SET full_name = $1,
              email = $2,
              password_hash = $3
          WHERE id = $4
        `,
        [invitation.full_name, email, passwordHash, existingRemoteUser.rows[0].id]
      );
    } else {
      await client.query(
        `
          INSERT INTO users (full_name, email, password_hash, role, client_id)
          VALUES ($1, $2, $3, 'remote_user', $4)
        `,
        [invitation.full_name, email, passwordHash, invitation.client_id]
      );
    }

    await client.query(
      `
        UPDATE remote_access_tokens
        SET status = 'used',
            used_at = NOW()
        WHERE id = $1
      `,
      [invitation.id]
    );

    await client.query(
      `
        UPDATE remote_access_tokens
        SET status = 'expired'
        WHERE client_id = $1
          AND status = 'active'
          AND id <> $2
      `,
      [invitation.client_id, invitation.id]
    );

    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Failed to complete remote access setup" });
  } finally {
    client.release();
  }
});

app.get("/api/remote-user/profile", requireRemoteUserAuth, async (req, res) => {
  try {
    // Backend scoping: remote users never choose a client id. The token decides it.
    const result = await pool.query(
      `
        SELECT id, full_name, email, phone, address, zip_code, city, state
        FROM clients
        WHERE id = $1
      `,
      [req.auth.client_id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Profile not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch remote user profile" });
  }
});

app.get("/api/remote-user/cases", requireRemoteUserAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `
        SELECT id, name, status, deadline, short_description, created_at
        FROM cases
        WHERE client_id = $1
        ORDER BY created_at DESC
      `,
      [req.auth.client_id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch remote user cases" });
  }
});

app.get("/api/remote-user/timeline", requireRemoteUserAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `
        SELECT id, name, deadline, short_description, created_at
        FROM cases
        WHERE client_id = $1
        ORDER BY created_at DESC
      `,
      [req.auth.client_id]
    );

    const events = result.rows.flatMap((entry) => {
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
        timeline.push({
          case_id: entry.id,
          case_name: entry.name,
          title: "Deadline scheduled",
          description: `Deadline set for ${entry.deadline}`,
          occurred_at: `${entry.deadline}T00:00:00`,
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

app.post("/api/auth/signup", async (req, res) => {
  try {
    const { full_name, email, password } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({ error: "Full name, email, and password are required." });
    }

    const existingUser = await pool.query(
      "SELECT id FROM users WHERE LOWER(email) = $1",
      [email.trim().toLowerCase()]
    );

    if (existingUser.rows.length) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `
        INSERT INTO users (full_name, email, password_hash, role)
        VALUES ($1, $2, $3, 'staff')
        RETURNING id, full_name, email, role
      `,
      [full_name.trim(), email.trim().toLowerCase(), passwordHash]
    );

    const user = result.rows[0];
    const token = signAuthToken({
      id: user.id,
      email: user.email,
      role: user.role
    });

    res.status(201).json({ user, token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Signup failed." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const identifier = String(req.body.identifier || req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!identifier || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const result = await pool.query(
      `
        SELECT id, full_name, email, password_hash, role, client_id
        FROM users
        WHERE LOWER(email) = $1
      `,
      [identifier]
    );

    if (!result.rows.length) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const user = result.rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const token = signAuthToken({
      id: user.id,
      email: user.email,
      role: user.role || "staff",
      client_id: user.client_id || null
    });

    res.json({
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role || "staff",
        client_id: user.client_id || null
      },
      token
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Login failed." });
  }
});

ensureRemoteAccessSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Backend running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to prepare backend schema", error);
    process.exit(1);
  });
