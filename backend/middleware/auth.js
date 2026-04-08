const jwt = require("jsonwebtoken");
const prisma = require("../prisma");
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

function requireCaseEditAccess(req, res, next) {
  return requireAuth(req, res, async () => {
    try {
      const caseId = Number(req.params.id || req.params.case_id);
      if (!Number.isInteger(caseId) || caseId <= 0) {
        return res.status(400).json({ error: "Invalid case id" });
      }

      const entry = await prisma.case.findUnique({
        where: { id: caseId },
        select: {
          id: true,
          owner_id: true,
          case_assignments: {
            select: { user_id: true }
          }
        }
      });

      if (!entry) {
        return res.status(404).json({ error: "Case not found" });
      }

      if (req.auth.role === "admin") {
        req.caseAccess = {
          id: entry.id,
          owner_id: entry.owner_id,
          isOwner: String(entry.owner_id || "") === String(req.auth.id),
          isAssigned: entry.case_assignments.some((assignment) => String(assignment.user_id) === String(req.auth.id)),
          canEdit: true
        };
        return next();
      }

      const isOwner = String(entry.owner_id || "") === String(req.auth.id);
      const isAssigned = entry.case_assignments.some(
        (assignment) => String(assignment.user_id) === String(req.auth.id)
      );

      if (!isOwner && !isAssigned) {
        return res.status(403).json({ error: "You do not have edit access to this case" });
      }

      req.caseAccess = {
        id: entry.id,
        owner_id: entry.owner_id,
        isOwner,
        isAssigned,
        canEdit: true
      };
      return next();
    } catch (error) {
      console.error("Case access check failed:", error);
      return res.status(500).json({ error: "Failed to verify case access" });
    }
  });
}

module.exports = {
  getBearerToken,
  requireAuth,
  requireCaseEditAccess
};
