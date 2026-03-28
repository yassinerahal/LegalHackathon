const jwt = require("jsonwebtoken");
require("dotenv").config();

function getBearerToken(req) {
  const authHeader = req.headers.authorization || "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
}

function requireAuth(req, res, next) {
  const token = getBearerToken(req);

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded?.is_approved || decoded.role === "pending") {
      return res.status(403).json({ error: "Waiting for Admin Approval" });
    }

    req.user = decoded;
    req.auth = decoded;
    return next();
  } catch (error) {
    return res.status(403).json({ error: "Invalid or expired session" });
  }
}

module.exports = {
  getBearerToken,
  requireAuth
};
